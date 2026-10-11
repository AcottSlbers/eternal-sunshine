import type { CameraAttribution, CameraSource } from "@/types/camera";
import type { RankingResponse, SunsetVisibility } from "@/types/ranking";
import { getCameraAttribution } from "@/lib/providers/attribution";
import type { CredibleSunsetDecision } from "@/lib/sunset-visibility";

export const CALIBRATION_STORAGE_KEY = "eternal-sunshine.calibration.v1";
export type HumanChoice = "a" | "b" | "equal" | "neither";
export type CalibrationSort = "finalScore" | "sunsetScore" | "evidence" | "provider";
export interface CalibrationSnapshot {
  cameraId: string;
  provider: CameraSource;
  location: string;
  imageTimestamp: string | null;
  evidence: number;
  beauty: number;
  sunsetScore: number;
  finalScore: number;
  phase: number;
  solarElevation: number;
  stage: string;
  visibility: SunsetVisibility;
  reason: string;
  metrics: Record<string, number>;
}
export interface CalibrationCandidate {
  decision?: CredibleSunsetDecision;
  snapshot: CalibrationSnapshot;
  previewUrl?: string;
  attribution: CameraAttribution;
}
export interface HumanComparison {
  timestamp: string;
  rankingTimestamp: string;
  a: CalibrationSnapshot;
  b: CalibrationSnapshot;
  choice: HumanChoice;
}
export interface CalibrationFile { version: 1; comparisons: HumanComparison[] }

// Deliberately excludes image URLs and pixels from the persisted evaluation.
export function calibrationCandidates(ranking: RankingResponse): CalibrationCandidate[] {
  return ranking.candidateDiagnostics.flatMap((diagnostic) => {
    const score = diagnostic.scored;
    if (!diagnostic.imageAnalyzed || !score || score.visualScoreStatus !== "analyzed") return [];
    const camera = diagnostic.camera;
    return [{ decision: { isCredibleSunset: score.isCredibleSunset, primaryEvidencePath: score.primaryEvidencePath, credibleSunsetReason: score.credibleSunsetReason },
      previewUrl: camera.previewImageUrl ?? camera.lastKnownImageUrl ?? camera.imageUrl,
      attribution: getCameraAttribution(camera), snapshot: {
        cameraId: camera.id, provider: camera.source, location: camera.name,
        imageTimestamp: camera.lastKnownImageTimestamp ?? camera.imageUpdatedAt ?? null,
        evidence: score.sunsetEvidenceScore, beauty: score.sunsetBeautyScore,
        sunsetScore: score.sunsetScore, finalScore: score.finalScore,
        phase: score.sunsetPhaseScore, solarElevation: score.solarElevation, stage: score.stage,
        visibility: diagnostic.visibility, reason: diagnostic.reason + (diagnostic.suppression ? `; ${diagnostic.suppression.reason}` : ""),
        metrics: { ...score.sunsetMetrics },
      } }];
  });
}

export function sortCalibration(candidates: CalibrationCandidate[], sort: CalibrationSort) {
  return [...candidates].sort((a, b) => {
    const difference = sort === "provider" ? a.snapshot.provider.localeCompare(b.snapshot.provider)
      : b.snapshot[sort] - a.snapshot[sort];
    return difference || a.snapshot.cameraId.localeCompare(b.snapshot.cameraId);
  });
}

function validSnapshot(value: unknown): value is CalibrationSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["cameraId", "location", "stage", "reason"].every((key) => typeof item[key] === "string")
    && ["windy", "meteogalicia", "mock"].includes(String(item.provider))
    && ["visible", "featured", "rejected-evidence", "rejected-other"].includes(String(item.visibility))
    && (item.imageTimestamp === null || typeof item.imageTimestamp === "string")
    && ["evidence", "beauty", "sunsetScore", "finalScore", "phase", "solarElevation"].every((key) => typeof item[key] === "number" && Number.isFinite(item[key]))
    && !!item.metrics && typeof item.metrics === "object" && !Array.isArray(item.metrics)
    && Object.values(item.metrics).every((metric) => typeof metric === "number" && Number.isFinite(metric));
}

export function parseCalibration(raw: string | null): CalibrationFile {
  if (raw === null) return { version: 1, comparisons: [] };
  const file = JSON.parse(raw) as Partial<CalibrationFile> | null;
  if (!file || file.version !== 1 || !Array.isArray(file.comparisons) || !file.comparisons.every((item) =>
    item && typeof item.timestamp === "string" && typeof item.rankingTimestamp === "string"
    && Number.isFinite(Date.parse(item.timestamp)) && Number.isFinite(Date.parse(item.rankingTimestamp))
    && validSnapshot(item.a) && validSnapshot(item.b) && item.a.cameraId !== item.b.cameraId
    && ["a", "b", "equal", "neither"].includes(item.choice))) {
    throw new Error("Local calibration data is invalid or uses an unsupported version. Existing data has not been overwritten.");
  }
  return file as CalibrationFile;
}

export function saveComparison(file: CalibrationFile, comparison: HumanComparison): CalibrationFile {
  const pairKey = (item: HumanComparison) => JSON.stringify([item.rankingTimestamp, ...[item.a.cameraId, item.b.cameraId].sort()]);
  return { version: 1, comparisons: [...file.comparisons.filter((item) => pairKey(item) !== pairKey(comparison)), comparison] };
}

export function calibrationSummary(comparisons: HumanComparison[]) {
  const preferences = comparisons.filter((item) => item.choice === "a" || item.choice === "b");
  const matched = preferences.filter((item) => item.choice === "a" ? item.a.sunsetScore > item.b.sunsetScore : item.b.sunsetScore > item.a.sunsetScore).length;
  const neither = comparisons.filter((item) => item.choice === "neither");
  const falsePositives = new Set(neither.flatMap((item) => [item.a, item.b]
    .filter((camera) => camera.visibility === "visible" || camera.visibility === "featured")
    .map((camera) => JSON.stringify([camera.provider, camera.cameraId, camera.imageTimestamp ?? item.rankingTimestamp]))));
  return { count: comparisons.length, preferences: preferences.length, matched,
    agreementPercent: preferences.length ? 100 * matched / preferences.length : null,
    scoreTies: preferences.filter((item) => item.a.sunsetScore === item.b.sunsetScore).length,
    neither: neither.length, falsePositives: falsePositives.size };
}
