import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRanking } from "../lib/ranking";
import { Ranking } from "../components/Ranking";
import { DebugPanel } from "../components/DebugPanel";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import type { Camera } from "../types/camera";
import cameras from "../data/cameras.json";
import { createHeroSelector } from "../lib/public-ranking";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), refresh: vi.fn() }));
vi.mock("../data/cameras.json", () => ({ default: [
  { id: "snow", name: "Snowy station", latitude: 0, longitude: 0, source: "windy", enabled: true, qualityWeight: 1, imageUrl: "https://example.test/snow" },
  { id: "twilight", name: "Weak twilight", latitude: 0, longitude: 0, source: "windy", enabled: true, qualityWeight: 1, imageUrl: "https://example.test/twilight" },
  { id: "sunset", name: "Visible sunset", latitude: 0, longitude: 0, source: "windy", enabled: true, qualityWeight: 1, imageUrl: "https://example.test/sunset" },
  { id: "extended", name: "Extended sunset", latitude: 0, longitude: 5, source: "windy", enabled: true, qualityWeight: 1, imageUrl: "https://example.test/extended" },
  { id: "sunrise", name: "Sunrise camera", latitude: 0, longitude: 180, source: "windy", enabled: true, qualityWeight: 1, imageUrl: "https://example.test/sunrise" },
].map((camera, index) => ({ ...camera, latitude: index * 0.5, imageUpdatedAt: "2026-03-20T18:00:00Z" })) }));
vi.mock("../lib/providers/windy-webcam-provider", () => ({
  WindyWebcamProvider: class { getCameras = mocks.refresh; },
}));
vi.mock("../lib/image-score", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/image-score")>();
  return { ...original, fetchCandidateImageAnalysis: mocks.analyze };
});

const date = new Date("2026-03-20T18:08:00Z");
function analysis(evidence: number, score: number) {
  return {
    viability: { viable: true, status: "viable", brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0 },
    visual: { ...UNAVAILABLE_VISUAL_SUNSET_SCORE, status: "analyzed", sunsetEvidenceScore: evidence, sunsetScore: score },
  };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.refresh.mockReset().mockResolvedValue([] satisfies Camera[]);
  mocks.analyze.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith("snow")) return analysis(9.2, 6.3);
    if (url.endsWith("twilight")) return analysis(25, 25);
    if (url.endsWith("extended")) return analysis(60, 50);
    return analysis(70, 65);
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("runtime visible sunset selection", () => {
  it("renders a retained hero independently of its nearby challenger winning the public card slot", async () => {
    mocks.refresh.mockImplementation(async (ids: string[]) => cameras.filter((camera) => ids.includes(camera.id)).map((camera) => camera.id === "twilight" ? { ...camera, latitude: 1.01 } : camera));
    const selectHero = createHeroSelector();
    expect((await createRanking(date, selectHero)).featuredCameraId).toBe("sunset");
    mocks.analyze.mockImplementation(async (url: string) => analysis(70, url.endsWith("twilight") ? 66 : url.endsWith("sunset") ? 65 : 10));
    const ranking = await createRanking(date, selectHero);
    expect(ranking.results.map((item) => item.camera.id)).toEqual(["twilight"]);
    expect(ranking.featuredCameraId).toBe("sunset");
    expect(ranking.featuredSunset?.sunsetScore).toBe(65);
    const html = renderToStaticMarkup(React.createElement(Ranking, { ranking }));
    expect(html).toContain("Best sunset right now");
    expect(html).toContain("Visible sunset");
    expect(html).toContain("Weak twilight");
    expect(ranking.diagnostics.scoreGapToSecond).toBeNull();
  });

  it("retains geographically suppressed scores and reasons in debug, not public cards", async () => {
    mocks.refresh.mockImplementation(async (ids: string[]) => cameras.filter((camera) => ids.includes(camera.id)).map((camera) => camera.id === "twilight" ? { ...camera, latitude: 1.01 } : camera));
    const ranking = await createRanking(date, createHeroSelector());
    expect(ranking.results.map((item) => item.camera.id)).toEqual(["sunset", "extended"]);
    expect(ranking.diagnostics).toMatchObject({ visibleSunsets: 3, publicRanked: 2, suppressedNearby: 1 });
    const suppressed = ranking.candidateDiagnostics.find((item) => item.camera.id === "twilight")!;
    expect(suppressed.visibility).toBe("visible");
    expect(suppressed.scored?.sunsetScore).toBe(25);
    expect(suppressed.suppression).toMatchObject({ keptCameraId: "sunset", reason: "suppressed: nearby higher-ranked camera" });
    expect(renderToStaticMarkup(React.createElement(Ranking, { ranking }))).not.toContain("Weak twilight");
    const debugHtml = renderToStaticMarkup(React.createElement(DebugPanel, { ranking }));
    expect(debugHtml).toContain("Weak twilight");
    expect(debugHtml).toContain("suppressed: nearby higher-ranked camera");
    expect(ranking.debug.find((item) => item.cameraId === "twilight")?.reason).toBe(suppressed.suppression?.reason);
  });

  it("gates after analysis, expands for visible count, keeps debug scores, and excludes sunrise before requests", async () => {
    const ranking = await createRanking(date, createHeroSelector());
    expect(ranking.results.map((item) => item.camera.id)).toEqual(["sunset", "extended", "twilight"]);
    expect(ranking.featuredCameraId).toBe("sunset");
    const scores = ranking.results.map((item) => item.finalScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranking.diagnostics).toEqual({ astronomical: 4, imagesAnalyzed: 4, visibleSunsets: 3, publicRanked: 3, suppressedNearby: 0, scoreGapToSecond: Math.round((scores[0] - scores[1]) * 10) / 10, rejectedEvidence: 1, rejectedOther: 0, featured: 2 });
    expect(mocks.refresh.mock.calls).toEqual([[["snow", "twilight", "sunset"]], [["extended"]]]);
    expect(mocks.analyze).toHaveBeenCalledTimes(4);
    const rejected = ranking.candidateDiagnostics.find((item) => item.camera.id === "snow")!;
    expect(rejected.scored?.sunsetEvidenceScore).toBe(9.2);
    expect(rejected.reason).toBe("Rejected: insufficient sunset evidence");
    const publicHtml = renderToStaticMarkup(React.createElement(Ranking, { ranking }));
    expect(publicHtml).not.toContain("Snowy station");
    expect(publicHtml).toContain("Best sunset right now");
    const debugHtml = renderToStaticMarkup(React.createElement(DebugPanel, { ranking }));
    expect(debugHtml).toContain("Snowy station");
    expect(debugHtml).toContain("Rejected: insufficient sunset evidence");
    expect(debugHtml).toContain("9.2");
  });

  it("shows the empty state and no hero when every image lacks evidence", async () => {
    mocks.analyze.mockResolvedValue(analysis(9.2, 6.3));
    const ranking = await createRanking(date);
    expect(ranking.results).toEqual([]);
    expect(ranking.featuredCameraId).toBeNull();
    expect(ranking.diagnostics.rejectedEvidence).toBe(4);
    const html = renderToStaticMarkup(React.createElement(Ranking, { ranking }));
    expect(html).toContain("Searching for the next great sunset");
    expect(html).not.toContain("Snowy station");
    expect(html).not.toContain("Best sunset right now");
  });

  it("allows marginal visible twilight in cards but never promotes it to hero", async () => {
    mocks.analyze.mockResolvedValue(analysis(25, 25));
    const ranking = await createRanking(date);
    expect(ranking.results).toHaveLength(4);
    expect(ranking.featuredCameraId).toBeNull();
    expect(renderToStaticMarkup(React.createElement(Ranking, { ranking }))).not.toContain("Best sunset right now");
  });

  it("isolates failed analysis and accounts for it separately from low evidence", async () => {
    mocks.analyze.mockImplementation(async (url: string) => {
      if (url.endsWith("snow")) throw new Error("decode failed");
      return analysis(70, 65);
    });
    const ranking = await createRanking(date);
    expect(ranking.results).toHaveLength(3);
    expect(ranking.diagnostics.rejectedOther).toBe(1);
    expect(ranking.diagnostics.rejectedEvidence).toBe(0);
    expect(ranking.diagnostics.imagesAnalyzed).toBe(3);
  });
});
