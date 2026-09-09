import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRanking } from "../lib/ranking";
import { createHeroSelector } from "../lib/public-ranking";
import { toPublicRanking } from "../lib/public-response";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import type { Camera } from "../types/camera";

const mocks = vi.hoisted(() => ({ windy: vi.fn(), meteo: vi.fn(), analyze: vi.fn(), registry: [] as Camera[] }));
vi.mock("../lib/camera-registry", () => ({ cameraRegistry: mocks.registry }));
vi.mock("../lib/providers/windy-webcam-provider", () => ({ WindyWebcamProvider: class { getCameras = mocks.windy; } }));
vi.mock("../lib/providers/meteogalicia-webcam-provider", () => ({ MeteoGaliciaWebcamProvider: class { getCameras = mocks.meteo; } }));
vi.mock("../lib/image-score", async (original) => ({ ...await original<typeof import("../lib/image-score")>(), fetchCandidateImageAnalysis: mocks.analyze }));
const date = new Date("2026-03-20T18:08:00Z");
const camera = (id: string, source: Camera["source"], longitude: number): Camera => ({
  id, name: id, source, longitude, latitude: 0, enabled: true, qualityWeight: 1,
  imageUrl: `https://example.test/${id}/full.jpg`, previewImageUrl: source === "meteogalicia" ? `https://example.test/${id}/mini.jpg` : undefined,
  imageUpdatedAt: "2026-03-20T18:00:00Z",
});

beforeEach(() => {
  mocks.registry.splice(0, mocks.registry.length, camera("windy-one", "windy", 0), camera("meteogalicia:1", "meteogalicia", .5), camera("meteogalicia:2", "meteogalicia", 1), camera("meteogalicia:outside", "meteogalicia", 90));
  mocks.windy.mockReset().mockResolvedValue([]);
  mocks.meteo.mockReset().mockImplementation(async (ids: string[]) => mocks.registry.filter((item) => ids.includes(item.id)));
  mocks.analyze.mockReset().mockResolvedValue({ viability: { status: "viable", viable: true, brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0 },
    visual: { ...UNAVAILABLE_VISUAL_SUNSET_SCORE, status: "analyzed", sunsetEvidenceScore: 70, sunsetBeautyScore: 65, sunsetScore: 68 } });
});
afterEach(() => vi.restoreAllMocks());

describe("multi-provider runtime safety", () => {
  it("filters locally, batches each source independently and analyzes mini images while displaying full images", async () => {
    const result = await createRanking(date, createHeroSelector());
    expect(mocks.windy.mock.calls).toEqual([[["windy-one"]]]);
    expect(mocks.meteo.mock.calls).toEqual([[["meteogalicia:1", "meteogalicia:2"]]]);
    expect(mocks.analyze).toHaveBeenCalledTimes(3);
    const urls = mocks.analyze.mock.calls.map((call) => call[0]);
    expect(urls).toContain("https://example.test/meteogalicia:1/mini.jpg");
    expect(urls.some((url: string) => url.includes("outside"))).toBe(false);
    expect(toPublicRanking(result).results.find((item) => item.camera.id === "meteogalicia:1")?.camera.previewUrl).toBe("https://example.test/meteogalicia:1/full.jpg");
    expect(result.providerDiagnostics.meteogalicia).toMatchObject({ registry: 3, astronomical: 2, imagesAnalyzed: 2, visible: 2, featured: 2 });
    expect(result.candidateDiagnostics.filter((item) => item.scored).map((item) => item.scored!.sunsetScore)).toEqual([68, 68, 68]);
  });
  it("does not contact MeteoGalicia at all when its cameras are outside the sunset window", async () => {
    for (const item of mocks.registry) if (item.source === "meteogalicia") item.longitude = 90;
    const result = await createRanking(date, createHeroSelector());
    expect(mocks.meteo).not.toHaveBeenCalled();
    expect(mocks.windy.mock.calls).toEqual([[["windy-one"]]]);
    expect(result.providerDiagnostics.meteogalicia.astronomical).toBe(0);
  });
  it.each(["stale", "invalid", "failure", "missing"])("rejects %s MeteoGalicia images without disrupting Windy", async (condition) => {
    if (condition === "failure") mocks.meteo.mockRejectedValue(new Error("Service unavailable"));
    else if (condition === "missing") mocks.meteo.mockResolvedValue([]);
    else mocks.meteo.mockImplementation(async (ids: string[]) => mocks.registry.filter((item) => ids.includes(item.id)).map((item) => ({ ...item,
      imageUpdatedAt: condition === "stale" ? "2026-03-18T18:00:00Z" : undefined })));
    const result = await createRanking(date, createHeroSelector());
    expect(result.results.map((item) => item.camera.id)).toEqual(["windy-one"]);
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    expect(result.providerDiagnostics.meteogalicia.visible).toBe(0);
    expect(result.candidateDiagnostics.filter((item) => item.camera.source === "meteogalicia").every((item) => item.visibility === "rejected-other")).toBe(true);
  });
});
