import { describe, expect, it } from "vitest";
import { cameraDistanceKm, createHeroSelector, deduplicatePublicRanking } from "../lib/public-ranking";
import { getSunsetStrength } from "../lib/sunset-strength";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import type { RankedSunset } from "../types/ranking";

const now = new Date("2026-09-05T12:00:00Z");
function candidate(id: string, finalScore: number, distanceKm = 0): RankedSunset {
  return {
    camera: { id, name: "Same location name", region: "Same region", source: "windy", latitude: 0,
      longitude: distanceKm / 6371 * 180 / Math.PI, enabled: true, qualityWeight: 1, imageUpdatedAt: now.toISOString() },
    solarElevation: -1, solarAzimuth: 270, solarElevationLater: -2, solarElevationTrend: "descending",
    solarTrendDegreesPerMinute: -0.1, isSunSetting: true, stage: "strict", sunsetOpportunityScore: 90,
    sunsetPhaseScore: 90, sunAlignmentScore: 90, directionConfidence: "unknown", imageAgeMinutes: 0,
    freshnessScore: 100, imageViability: { viable: true, status: "viable", brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0 },
    sunsetEvidenceScore: 70, sunsetBeautyScore: 80, sunsetScore: finalScore, finalScore,
    sunsetMetrics: UNAVAILABLE_VISUAL_SUNSET_SCORE.metrics, visualScoreStatus: "analyzed", scoreKind: "visual",
  };
}

describe("geographically diverse public ranking", () => {
  it("keeps score 70 over 62 at 5 km without mutating inputs", () => {
    const input = [candidate("lower", 62, 5), candidate("higher", 70)];
    const snapshot = structuredClone(input);
    const result = deduplicatePublicRanking(input);
    expect(result.results.map((item) => item.finalScore)).toEqual([70]);
    expect(result.suppressed).toEqual([{ cameraId: "lower", keptCameraId: "higher", distanceKm: 5, reason: "suppressed: nearby higher-ranked camera" }]);
    expect(input).toEqual(snapshot);
  });
  it.each([100, 150])("keeps cameras %i km apart despite identical names and regions", (distance) => {
    expect(deduplicatePublicRanking([candidate("a", 70), candidate("b", 62, distance)]).results).toHaveLength(2);
  });
  it("uses a configurable radius and deterministic ties", () => {
    const input = [candidate("b", 70, 5), candidate("a", 70)];
    expect(deduplicatePublicRanking(input).results[0].camera.id).toBe("a");
    expect(deduplicatePublicRanking([...input].reverse())).toEqual(deduplicatePublicRanking(input));
    expect(deduplicatePublicRanking(input, 4).results).toHaveLength(2);
  });
  it("does not chain nearby groups across a large region", () => {
    expect(deduplicatePublicRanking([candidate("a", 70), candidate("b", 65, 20), candidate("c", 60, 40)]).results.map((item) => item.camera.id)).toEqual(["a", "c"]);
  });
  it("handles longitude wraparound", () => {
    expect(cameraDistanceKm({ latitude: 0, longitude: 179.99 }, { latitude: 0, longitude: -179.99 })).toBeCloseTo(2.224, 2);
  });
  it("suppresses the real Azeyskoye coordinate pair when both cameras qualify", () => {
    const first = candidate("first", 70);
    const second = candidate("second", 62);
    Object.assign(first.camera, { latitude: 54.53189, longitude: 100.59752 });
    Object.assign(second.camera, { latitude: 54.5581, longitude: 100.57851 });
    const distance = cameraDistanceKm(first.camera, second.camera);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(3.3);
    expect(deduplicatePublicRanking([first, second]).results.map((item) => item.camera.id)).toEqual(["first"]);
  });
});

describe("hero hysteresis", () => {
  it.each([[71, "current"], [73, "challenger"], [75, "challenger"]])("compares current 70 to challenger %i", (score, expected) => {
    const select = createHeroSelector();
    select([candidate("current", 70)], now);
    const input = [candidate("current", 70), candidate("challenger", score, 5)];
    expect(select(input, now).featuredSunset?.camera.id).toBe(expected);
    expect(deduplicatePublicRanking(input).results[0].camera.id).toBe("challenger");
    expect(input[0].finalScore).toBe(70);
  });
  it.each(["stale", "featured", "visible", "missing", "invalid", "unknown freshness", "rising"])("replaces a %s hero immediately", (failure) => {
    const select = createHeroSelector();
    select([candidate("current", 70)], now);
    const current = candidate("current", 70);
    if (failure === "stale") current.camera.imageUpdatedAt = "2026-09-04T12:00:00Z";
    if (failure === "featured") current.sunsetEvidenceScore = 25;
    if (failure === "visible") current.sunsetScore = 19;
    if (failure === "invalid") current.imageViability.viable = false;
    if (failure === "unknown freshness") { delete current.camera.imageUpdatedAt; delete current.imageAgeMinutes; }
    if (failure === "rising") current.isSunSetting = false;
    const input = failure === "missing" ? [] : [current];
    expect(select([...input, candidate("replacement", 60)], now).featuredSunset?.camera.id).toBe("replacement");
  });
  it("clears state when no fresh featured candidate remains", () => {
    const select = createHeroSelector();
    select([candidate("current", 70)], now);
    expect(select([candidate("weak", 25)], now).featuredSunset).toBeNull();
    expect(select([], now).heroDecision.previousCameraId).toBeNull();
  });
  it("compares refreshed scores, not historical scores", () => {
    const select = createHeroSelector();
    select([candidate("current", 90)], now);
    expect(select([candidate("current", 50), candidate("challenger", 60)], now).featuredSunset?.camera.id).toBe("challenger");
  });
  it("does not let an older overlapping evaluation overwrite state", () => {
    const select = createHeroSelector();
    select([candidate("newer", 70)], now);
    select([candidate("older", 70)], new Date(now.getTime() - 1000));
    expect(select([candidate("newer", 70), candidate("older", 71)], now).featuredSunset?.camera.id).toBe("newer");
  });
});

describe("presentation-only sunset strength", () => {
  it.each([[0, "not visible"], [19.9, "not visible"], [20, "subtle"], [39.9, "subtle"], [40, "good"], [59.9, "good"], [60, "strong"], [79.9, "strong"], [80, "spectacular"], [100, "spectacular"]])("labels %i as %s", (score, label) => {
    expect(getSunsetStrength(score)).toBe(label);
  });
});
