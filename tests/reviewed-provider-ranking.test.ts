import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Camera } from "../types/camera";
import { createRanking } from "../lib/ranking";
import { createHeroSelector } from "../lib/public-ranking";
import { toPublicRanking } from "../lib/public-response";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import { PROVIDERS } from "../lib/providers/catalogue";

const mocks = vi.hoisted(() => ({ registry: [] as Camera[], refresh: vi.fn(), analyze: vi.fn() }));
vi.mock("../lib/camera-registry", () => ({ cameraRegistry: mocks.registry }));
vi.mock("../lib/providers/official-webcam-provider", () => ({ OfficialWebcamProvider: class { getCameras = mocks.refresh; } }));
vi.mock("../lib/providers/cached-image-analysis", () => ({ fetchReviewedProviderAnalysis: mocks.analyze }));
const date = new Date("2026-03-20T18:08:00Z");
beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.registry.splice(0, mocks.registry.length, { id: "digitraffic:C1453508", source: "digitraffic", canonicalProvider: "digitraffic", name: "Scenic test",
    latitude: 0, longitude: 0.5, enabled: true, supportsVisualScoring: true, qualityWeight: 1,
    imageUrl: "https://weathercam.digitraffic.fi/C1453508.jpg", imageUpdatedAt: "2026-03-19T18:00:00Z", lastKnownImageTimestamp: "2026-03-19T18:00:00Z", attribution: PROVIDERS.digitraffic.attribution });
  mocks.refresh.mockReset().mockImplementation(async () => mocks.registry.map(c => ({ ...c, imageUpdatedAt: "2026-03-20T18:00:00Z" })));
  mocks.analyze.mockReset().mockResolvedValue({ viability: { status: "viable", viable: true, brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0 },
    visual: { ...UNAVAILABLE_VISUAL_SUNSET_SCORE, status: "analyzed", sunsetEvidenceScore: 70, sunsetBeautyScore: 65, sunsetScore: 68 } });
});
describe("reviewed cameras through the normal ranking gates", () => {
  it("refreshes preset timestamps, passes the same gates and retains public attribution", async () => {
    const result = await createRanking(date, createHeroSelector());
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ sunsetScore: 68, sunsetEvidenceScore: 70 });
    expect(result.results[0].imageAgeMinutes).toBe(8);
    expect(toPublicRanking(result).results[0].camera.attribution).toEqual(PROVIDERS.digitraffic.attribution);
    expect(result.providerDiagnostics.digitraffic).toMatchObject({ registry: 1, astronomical: 1, imagesAnalyzed: 1, publicRanked: 1 });
  });
  it("does not contact providers or download pixels outside the astronomical window", async () => {
    mocks.registry[0].longitude = 90;
    const result = await createRanking(date, createHeroSelector());
    expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
    expect(result.providerDiagnostics.digitraffic.astronomical).toBe(0);
  });
  it.each(["missing", "failure", "inactive", "coordinates", "stale", "invalid", "future", "policy"])("fails closed for %s metadata", async condition => {
    if (condition === "missing") mocks.refresh.mockResolvedValue([]);
    else if (condition === "failure") mocks.refresh.mockRejectedValue(new Error("Provider unavailable"));
    else if (condition === "policy") vi.stubEnv("ENABLE_DIGITRAFFIC_PROVIDER", "false");
    else mocks.refresh.mockResolvedValue(mocks.registry.map(c => ({ ...c,
      enabled: condition !== "inactive", latitude: condition === "coordinates" ? 1 : c.latitude,
      imageUpdatedAt: condition === "stale" ? "2026-03-20T17:00:00Z" : condition === "invalid" ? undefined : condition === "future" ? "2026-03-20T18:20:00Z" : "2026-03-20T18:00:00Z" })));
    const result = await createRanking(date, createHeroSelector());
    expect(result.results).toHaveLength(0); expect(mocks.analyze).not.toHaveBeenCalled();
    expect(result.candidateDiagnostics[0].visibility).toBe("rejected-other");
  });
  it("does not promote daylight/gray frames merely because a provider is approved", async () => {
    mocks.analyze.mockResolvedValue({ viability: { status: "viable", viable: true }, visual: { ...UNAVAILABLE_VISUAL_SUNSET_SCORE, status: "analyzed", sunsetEvidenceScore: 5, sunsetBeautyScore: 10, sunsetScore: 8 } });
    const result = await createRanking(date, createHeroSelector());
    expect(result.results).toHaveLength(0); expect(result.featuredSunset).toBeNull();
    expect(result.candidateDiagnostics[0].visibility).toBe("rejected-evidence");
  });
});
