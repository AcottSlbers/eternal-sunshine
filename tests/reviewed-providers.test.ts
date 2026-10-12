import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { approvedProviderCameras, reviewedProviderCameras } from "../lib/reviewed-provider-cameras";
import { normalizeUsgs, normalizeDigitraffic } from "../lib/providers/official-normalizers";
import { createProviderImageCache } from "../lib/providers/image-cache";
import { providerFetch } from "../lib/providers/http-cache";
import { createCachedProviderAnalysis } from "../lib/providers/cached-image-analysis";
import { UNAVAILABLE_IMAGE_VIABILITY } from "../lib/image-viability";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import { PROVIDERS } from "../lib/providers/catalogue";
import { HeroSunset } from "../components/HeroSunset";
import { Ranking } from "../components/Ranking";
import type { ProviderReviewFile } from "../types/provider-review";
import type { PublicSunset } from "../types/public-ranking";
import type { SolarImageContext } from "../lib/sunset-evidence";

describe("bounded reviewed provider integration", () => {
  it("rejects USGS coordinate placeholders without substituting volcano location; retains explicit bearings", () => {
    const rows = normalizeUsgs({ webcams: [
      { webcamCode: "kilauea-KW", latitude: 0, longitude: 0, vLatitude: 19.4, vLongitude: -155.3, bearingDeg: 90 },
      { webcamCode: "msh-tested", latitude: 46.2, longitude: -122.2, bearingDeg: 174, hasImages: "Y", currentImageUrl: "https://volcview.wr.usgs.gov/test.jpg", externalUrl: "https://volcanoes.usgs.gov/cams/", newestImage: { imageTimestamp: 1774030000 } },
      { webcamCode: "kilauea-thirdparty", latitude: 19.4, longitude: -155.3, hasImages: "Y", currentImageUrl: "https://volcview.wr.usgs.gov/third.jpg" },
    ] });
    expect(rows.map(row => row.id)).toEqual(["usgs:msh-tested", "usgs:kilauea-thirdparty"]);
    expect(rows[0]).toMatchObject({ viewAzimuth: 174, directionConfidence: "metadata", enabled: true });
    expect(rows[1]).toMatchObject({ enabled: false, supportsVisualScoring: false, directionConfidence: "unknown" });
    expect(rows[1].viewAzimuth).toBeUndefined();
  });
  it("keeps relative Digitraffic road direction unknown and uses preset capture time", () => {
    const feature = { id: "C14535", geometry: { coordinates: [20.8, 69] }, properties: { name: "Station", collectionStatus: "GATHERING", state: "OK", presets: [{ id: "C1453508", inCollection: true, presentationName: "Saanatunturi", direction: "SPECIAL_DIRECTION" }] } };
    const cameras = normalizeDigitraffic({ features: [feature] }, { stations: [{ presets: [{ id: "C1453508", measuredTime: "2026-10-11T12:00:00Z" }] }] });
    expect(cameras[0]).toMatchObject({ id: "digitraffic:C1453508", directionConfidence: "unknown", imageUpdatedAt: "2026-10-11T12:00:00.000Z" });
    expect(cameras[0].viewAzimuth).toBeUndefined();
  });
  it("loads only completed visual reviews, deduplicates stable IDs and enforces the cap", () => {
    const camera = reviewedProviderCameras[0];
    const valid = { id: camera.id, status: "accepted" as const, reason: "tested", camera, imageAttempted: true, imageDecoded: true, fresh: true, daylightValidated: true, horizonVerified: true };
    const review: ProviderReviewFile = { provider: "digitraffic", generatedAt: "", sampleLimit: 100, imageRequests: 100,
      rows: [valid, valid, { ...valid, status: "pending-manual-review" }, { ...valid, horizonVerified: false }, ...Array.from({ length: 60 }, (_, i) => ({ ...valid, id: `digitraffic:C99999${i}`, camera: { ...camera, id: `digitraffic:C99999${i}` } }))] };
    expect(approvedProviderCameras(review)).toHaveLength(50);
    expect(reviewedProviderCameras).toHaveLength(19);
    expect(reviewedProviderCameras.every(camera => camera.source === "digitraffic")).toBe(true);
  });
  it("reuses unchanged pixels with ETag revalidation and rejects unofficial image hosts", async () => {
    let time = 100;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(Buffer.from([255, 216, 255]), { headers: { "content-type": "image/jpeg", etag: '"same"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const cache = createProviderImageCache(fetcher, () => time);
    const first = await cache("usgs", "https://volcview.wr.usgs.gov/test.jpg");
    expect(await cache("usgs", "https://volcview.wr.usgs.gov/test.jpg")).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += PROVIDERS.usgs.imageTtlMs + 1;
    expect(await cache("usgs", "https://volcview.wr.usgs.gov/test.jpg")).toBe(first);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("If-None-Match")).toBe('"same"');
    await expect(cache("usgs", "https://unverified.example/image.jpg")).rejects.toThrow("approved official host");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reuses identical analysis while rescoring changed solar context and pixels", async () => {
    const image = { buffer: Buffer.from("pixels"), fingerprint: "a", checkedAt: 0 };
    const fetcher = vi.fn().mockResolvedValue(image);
    const visual = vi.fn().mockResolvedValue(UNAVAILABLE_VISUAL_SUNSET_SCORE);
    const viability = vi.fn().mockResolvedValue(UNAVAILABLE_IMAGE_VIABILITY);
    const analyze = createCachedProviderAnalysis(fetcher, visual, viability);
    const context: SolarImageContext = { isSunSetting: true, solarElevation: -1, solarAzimuth: 270 };
    await Promise.all([analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context), analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context)]);
    expect(visual).toHaveBeenCalledTimes(1); expect(viability).toHaveBeenCalledTimes(1);
    await analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, { ...context, solarElevation: -2 });
    expect(visual).toHaveBeenCalledTimes(2); expect(viability).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue({ ...image, fingerprint: "b" });
    await analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context);
    expect(visual).toHaveBeenCalledTimes(3); expect(viability).toHaveBeenCalledTimes(2);
  });
  it("allows NSW diagnosis to inspect manual redirects while normal requests still reject them", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://webcams.transport.nsw.gov.au/next.jpeg" } }));
    const response = await providerFetch("nsw", "https://webcams.transport.nsw.gov.au/test.jpeg", { redirect: "manual" }, fetcher);
    expect(response.status).toBe(302);
    await expect(providerFetch("nsw", "https://webcams.transport.nsw.gov.au/test.jpeg", {}, fetcher)).rejects.toThrow("HTTP 302");
  });
  it("revalidates a changed capture timestamp inside TTL without rescoring identical bytes/context", async () => {
    const fetcher = vi.fn().mockResolvedValue({ buffer: Buffer.from("same pixels"), fingerprint: "same", checkedAt: 0 });
    const visual = vi.fn().mockResolvedValue(UNAVAILABLE_VISUAL_SUNSET_SCORE);
    const analyze = createCachedProviderAnalysis(fetcher, visual, vi.fn().mockResolvedValue(UNAVAILABLE_IMAGE_VIABILITY));
    const context: SolarImageContext = { isSunSetting: true, solarElevation: -1, solarAzimuth: 270 };
    await analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context, "2026-10-11T12:00:00Z");
    await analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context, "2026-10-11T12:00:00Z");
    await analyze("digitraffic", "https://weathercam.digitraffic.fi/test.jpg", 80, context, "2026-10-11T12:10:00Z");
    expect(fetcher.mock.calls.map(call => call[2])).toEqual([true, false, true]);
    expect(visual).toHaveBeenCalledTimes(1);
  });
  it("renders actual Digitraffic source/license in Hero and cards without unrelated branding", () => {
    vi.stubGlobal("React", React);
    const camera = reviewedProviderCameras[0];
    const item: PublicSunset = { camera: { ...camera, hasLiveStream: false, previewUrl: camera.imageUrl }, sunsetScore: 65,
      sunsetStrength: "strong", imageAgeMinutes: 5, cameraTimeZone: "Europe/Helsinki" };
    for (const html of [renderToStaticMarkup(React.createElement(HeroSunset, { item, isUserSelected: false, generatedAt: "2026-10-11T12:00:00Z" })),
      renderToStaticMarkup(React.createElement(Ranking, { results: [item], generatedAt: "2026-10-11T12:00:00Z", onSelect: () => {} }))]) {
      expect(html).toContain("Fintraffic / digitraffic.fi"); expect(html).toContain("CC BY 4.0");
      expect(html).not.toContain("Windy Webcams"); expect(html).not.toContain("USGS");
    }
  });
});
