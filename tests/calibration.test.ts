import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { calibrationCandidates, calibrationSummary, parseCalibration, saveComparison, sortCalibration } from "../lib/calibration";
import type { CalibrationCandidate, HumanComparison } from "../lib/calibration";
import { CalibrationWorkbench } from "../components/CalibrationWorkbench";
import { UNAVAILABLE_VISUAL_SUNSET_SCORE } from "../lib/image-score";
import type { CandidateDiagnostic, RankingResponse } from "../types/ranking";

vi.stubGlobal("React", React);

function diagnostic(id: string, visibility: CandidateDiagnostic["visibility"] = "visible"): CandidateDiagnostic {
  const candidate = { camera: { id, name: id, latitude: 0, longitude: 0, enabled: true, qualityWeight: 1,
    source: "windy" as const, imageUrl: "https://example.test/full.jpg", imageUpdatedAt: "2026-09-09T18:00:00Z" },
    solarElevation: -2, solarAzimuth: 270, stage: "strict" as const, solarElevationLater: -4,
    solarTrendDegreesPerMinute: -.2, solarElevationTrend: "descending" as const, isSunSetting: true };
  return { ...candidate, visibility, reason: visibility, imageChecked: true, imageAnalyzed: true,
    scored: { ...candidate, sunsetEvidenceScore: 40, sunsetBeautyScore: 35, sunsetScore: 38, finalScore: 37,
      isCredibleSunset: visibility === "visible" || visibility === "featured", primaryEvidencePath: "chromatic", credibleSunsetReason: visibility,
      sunsetOpportunityScore: 90, sunsetPhaseScore: 95, sunAlignmentScore: 65, directionConfidence: "unknown",
      freshnessScore: 100, imageViability: { brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0, viable: true, status: "viable" },
      sunsetMetrics: { ...UNAVAILABLE_VISUAL_SUNSET_SCORE.metrics, skyConfidence: 75 }, visualScoreStatus: "analyzed", scoreKind: "visual" } };
}

export function calibrationRanking(): RankingResponse {
  const rejected = diagnostic("rejected", "rejected-evidence");
  const suppressed = { ...diagnostic("suppressed"), suppression: { cameraId: "suppressed", keptCameraId: "visible", distanceKm: 2, reason: "suppressed: nearby higher-ranked camera" as const } };
  const unavailable = { ...diagnostic("unavailable"), imageAnalyzed: false };
  return { generatedAt: "2026-09-09T18:05:00Z", candidateDiagnostics: [diagnostic("visible"), rejected, suppressed, unavailable],
    results: [], featuredCameraId: null, featuredSunset: null, heroDecision: { cameraId: null, previousCameraId: null, reason: "test" },
    candidatesEvaluated: 4, totalCameras: 4, sunsetWindows: { strict: { minimumElevation: -4.5, maximumElevation: 1.5 }, extended: { minimumElevation: -6, maximumElevation: 2.5 } },
    selectionStage: "strict", minimumDesiredCandidates: 8, debug: [], provider: { mode: "windy", refreshed: 4, imagesChecked: 4 },
    diagnostics: { astronomical: 4, imagesAnalyzed: 3, visibleSunsets: 2, publicRanked: 1, suppressedNearby: 1, scoreGapToSecond: null, rejectedEvidence: 1, rejectedOther: 1, featured: 0 },
    providerDiagnostics: { windy: { registry: 4, freshKnownImages: 4, astronomical: 4, evaluated: 4, imagesAnalyzed: 3, visible: 2, featured: 0, publicRanked: 1 } } };
}

function comparison(overrides: Partial<HumanComparison> = {}): HumanComparison {
  const candidates = calibrationCandidates(calibrationRanking());
  return { timestamp: "2026-09-09T18:06:00Z", rankingTimestamp: "2026-09-09T18:05:00Z",
    a: { ...candidates[0].snapshot, sunsetScore: 60 }, b: { ...candidates[1].snapshot, sunsetScore: 30 }, choice: "a", ...overrides };
}

describe("calibration measurements only", () => {
  it("includes analyzed rejected and suppressed cameras, excludes unavailable analysis, without changing ranking", () => {
    const ranking = calibrationRanking(); const before = JSON.stringify(ranking);
    const candidates = calibrationCandidates(ranking);
    expect(candidates.map((item) => item.snapshot.cameraId)).toEqual(["visible", "rejected", "suppressed"]);
    expect(candidates[2].snapshot.reason).toContain("nearby");
    expect(JSON.stringify(ranking)).toBe(before);
  });
  it("preserves provider and chooses the analyzed preview rather than the large image", () => {
    const ranking = calibrationRanking(); const camera = ranking.candidateDiagnostics[0].camera;
    camera.source = "meteogalicia"; camera.previewImageUrl = "https://example.test/mini.jpg";
    const candidate = calibrationCandidates(ranking)[0];
    expect(candidate.previewUrl).toContain("mini.jpg");
    expect(candidate.snapshot.provider).toBe("meteogalicia");
    expect(candidate.attribution.license).toBe("CC BY-SA 4.0");
  });
  it.each(["finalScore", "sunsetScore", "evidence", "provider"] as const)("sorts %s locally without mutating inputs", (sort) => {
    const candidates = calibrationCandidates(calibrationRanking());
    candidates[0].snapshot = { ...candidates[0].snapshot, finalScore: 0, evidence: 0, sunsetScore: 0 };
    const before = JSON.stringify(candidates);
    const sorted = sortCalibration(candidates, sort);
    expect(JSON.stringify(candidates)).toBe(before);
    expect(sorted).not.toBe(candidates);
    if (sort !== "provider") expect(sorted[0].snapshot[sort]).toBeGreaterThan(0);
  });
  it("round-trips versioned JSON containing both score sets, timestamps, IDs and metrics but no images/URLs", () => {
    const file = saveComparison(parseCalibration(null), comparison());
    const serialized = JSON.stringify(file);
    expect(parseCalibration(serialized)).toEqual(file);
    expect(file.comparisons[0].a.metrics.skyConfidence).toBe(75);
    expect(serialized).not.toContain("https:");
    expect(serialized).not.toContain("previewUrl");
  });
  it("rejudging the same unordered pair replaces its evaluation; a later snapshot is separate", () => {
    const first = comparison();
    const file = saveComparison(parseCalibration(null), first);
    const revised = saveComparison(file, comparison({ a: first.b, b: first.a, choice: "b" }));
    expect(revised.comparisons).toHaveLength(1);
    expect(saveComparison(revised, comparison({ rankingTimestamp: "2026-09-09T18:15:00Z" })).comparisons).toHaveLength(2);
  });
  it.each(["not json", "null", '{"version":2,"comparisons":[]}', '{"version":1,"comparisons":[{}]}'])("rejects corrupt storage %s", (raw) => {
    expect(() => parseCalibration(raw)).toThrow();
  });
  it("rejects identical cameras and invalid numeric scores", () => {
    const item = comparison();
    expect(() => parseCalibration(JSON.stringify({ version: 1, comparisons: [{ ...item, b: item.a }] }))).toThrow();
    expect(() => parseCalibration(JSON.stringify({ version: 1, comparisons: [{ ...item, a: { ...item.a, sunsetScore: null } }] }))).toThrow();
  });
  it("defines agreement with explicit denominators and treats score ties as non-matches", () => {
    const a = comparison();
    const result = calibrationSummary([a, comparison({ choice: "b" }), comparison({ choice: "equal" }), comparison({ choice: "neither" }), comparison({ b: { ...a.b, sunsetScore: 60 } })]);
    expect(result).toMatchObject({ count: 5, preferences: 3, matched: 1, scoreTies: 1, neither: 1 });
    expect(result.agreementPercent).toBeCloseTo(100 / 3);
    expect(calibrationSummary([]).agreementPercent).toBeNull();
  });
  it("counts unique visible false-positive frames only from neither judgments", () => {
    const item = comparison({ choice: "neither" });
    expect(calibrationSummary([item, { ...item, rankingTimestamp: "2026-09-09T18:15:00Z" }]).falsePositives).toBe(1);
    expect(calibrationSummary([comparison({ choice: "b" })]).falsePositives).toBe(0);
  });
  it("renders all metrics and pair controls safely during SSR without browser storage", () => {
    const ranking = calibrationRanking();
    const html = renderToStaticMarkup(React.createElement(CalibrationWorkbench, { candidates: calibrationCandidates(ranking), generatedAt: ranking.generatedAt, providers: ranking.providerDiagnostics }));
    for (const text of ["Camera A vs Camera B", "A is better", "B is better", "Neither is a sunset", "estimatedHorizonY", "skyConfidence", "horizonGlowScore", "Beauty", "rejected-evidence", "windy", "Export local JSON"]) expect(html).toContain(text);
    expect(html).not.toContain("<iframe");
  });
  it("renders a useful empty state", () => {
    const candidates: CalibrationCandidate[] = [];
    expect(renderToStaticMarkup(React.createElement(CalibrationWorkbench, { candidates, generatedAt: "2026-09-09T18:05:00Z", providers: {} }))).toContain("No analyzed astronomical candidates");
  });
});
