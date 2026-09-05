import camerasData from "@/data/cameras.json";
import { MINIMUM_DESIRED_CANDIDATES, STALE_IMAGE_MINUTES, SUNSET_WINDOWS } from "@/lib/config";
import { getCameraDirection, getSunAlignmentScore } from "@/lib/camera-direction";
import { UNAVAILABLE_IMAGE_VIABILITY } from "@/lib/image-viability";
import { fetchCandidateImageAnalysis, UNAVAILABLE_VISUAL_SUNSET_SCORE } from "@/lib/image-score";
import { WindyWebcamProvider } from "@/lib/providers/windy-webcam-provider";
import { getSolarPosition, getSolarTrend, getSunsetCandidates, getSunsetPhaseScore } from "@/lib/solar";
import { classifySunsetVisibility } from "@/lib/sunset-visibility";
import { getCameraTimeZone } from "@/lib/time-zone";
import type { Camera } from "@/types/camera";
import type { CameraDebugEntry, CandidateDiagnostic, CandidateStage, ImageViability, RankedSunset, RankingResponse, SunsetCandidate } from "@/types/ranking";

const cameras = camerasData as Camera[];

export function getImageFreshness(timestamp: string | undefined, now: Date): { ageMinutes?: number; score: number; stale: boolean } {
  if (!timestamp) return { score: 55, stale: false };
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return { score: 55, stale: false };
  const ageMinutes = Math.max(0, (now.getTime() - parsed) / 60_000);
  let score = 0;
  if (ageMinutes <= 15) score = 100;
  else if (ageMinutes <= 60) score = 90;
  else if (ageMinutes <= 180) score = 65;
  else if (ageMinutes <= STALE_IMAGE_MINUTES) score = 25;
  return { ageMinutes: Math.round(ageMinutes * 10) / 10, score, stale: ageMinutes > STALE_IMAGE_MINUTES };
}

export function getSunsetOpportunityScore(input: {
  sunsetPhaseScore: number; sunAlignmentScore: number; freshnessScore: number;
  imageViability: ImageViability; qualityWeight: number;
}): number {
  const viabilityScore = input.imageViability.status === "unavailable" ? 60 : input.imageViability.viable ? 100 : 0;
  const qualityScore = Math.max(0, Math.min(100, input.qualityWeight * 100));
  return Math.round(0.4 * input.sunsetPhaseScore + 0.25 * input.sunAlignmentScore + 0.15 * input.freshnessScore + 0.1 * viabilityScore + 0.1 * qualityScore);
}

export function getFinalScore(sunsetScore: number, sunsetOpportunityScore: number): number {
  return Math.round(sunsetScore * (0.88 + 0.12 * Math.max(0, Math.min(100, sunsetOpportunityScore)) / 100) * 10) / 10;
}

async function rankCandidate(candidate: SunsetCandidate, now: Date): Promise<CandidateDiagnostic> {
  const rejected = (reason: string): CandidateDiagnostic => ({ ...candidate, visibility: "rejected-other", reason, imageChecked: false, imageAnalyzed: false });
  const direction = getCameraDirection(candidate.camera);
  const alignment = getSunAlignmentScore(direction.viewAzimuth, candidate.solarAzimuth);
  if (alignment.difference !== undefined && alignment.difference > 120) return rejected(`Rejected: camera points ${alignment.difference.toFixed(0)}° away from the sun`);
  const freshness = getImageFreshness(candidate.camera.lastKnownImageTimestamp ?? candidate.camera.imageUpdatedAt, now);
  if (freshness.stale) return rejected(`Rejected: image is stale (${freshness.ageMinutes?.toFixed(0)} minutes old)`);
  const sunsetPhaseScore = getSunsetPhaseScore(candidate.solarElevation);
  const imageUrl = candidate.camera.lastKnownImageUrl ?? candidate.camera.imageUrl;
  const imageAnalysis = imageUrl && candidate.camera.source === "windy"
    ? await fetchCandidateImageAnalysis(imageUrl, sunsetPhaseScore)
    : { viability: UNAVAILABLE_IMAGE_VIABILITY, visual: UNAVAILABLE_VISUAL_SUNSET_SCORE };
  const imageViability = imageAnalysis.viability;
  const imageChecked = Boolean(imageUrl && candidate.camera.source === "windy");
  const sunsetOpportunityScore = getSunsetOpportunityScore({ sunsetPhaseScore, sunAlignmentScore: alignment.score, freshnessScore: freshness.score, imageViability, qualityWeight: candidate.camera.qualityWeight });
  const finalScore = candidate.camera.source === "windy" ? getFinalScore(imageAnalysis.visual.sunsetScore, sunsetOpportunityScore) : sunsetOpportunityScore;
  const scored: RankedSunset = {
    ...candidate, sunsetOpportunityScore, sunsetPhaseScore, sunAlignmentScore: alignment.score,
    alignmentDifference: alignment.difference, directionConfidence: direction.confidence, cameraViewAzimuth: direction.viewAzimuth,
    imageAgeMinutes: freshness.ageMinutes, freshnessScore: freshness.score, imageViability,
    sunsetEvidenceScore: imageAnalysis.visual.sunsetEvidenceScore, sunsetBeautyScore: imageAnalysis.visual.sunsetBeautyScore,
    sunsetScore: imageAnalysis.visual.sunsetScore, finalScore, sunsetMetrics: imageAnalysis.visual.metrics,
    visualScoreStatus: imageAnalysis.visual.status,
    cameraTimeZone: getCameraTimeZone(candidate.camera.latitude, candidate.camera.longitude),
    scoreKind: candidate.camera.source === "windy" ? "visual" : "temporary-mock",
    temporaryMockScore: candidate.camera.source === "mock" ? sunsetOpportunityScore : undefined,
  };
  return { ...candidate, scored, imageChecked, imageAnalyzed: imageAnalysis.visual.status === "analyzed", ...classifySunsetVisibility(scored) };
}

async function refreshAndRank(
  input: SunsetCandidate[], now: Date, provider: WindyWebcamProvider | undefined,
): Promise<{ ranked: RankedSunset[]; refreshed: number; evaluations: CandidateDiagnostic[] }> {
  const windyIds = input.filter(({ camera }) => camera.source === "windy").map(({ camera }) => camera.id);
  const latest = provider && windyIds.length > 0 ? await provider.getCameras(windyIds) : [];
  const latestById = new Map(latest.map((camera) => [camera.id, camera]));
  const refreshedCandidates = input.map((candidate) => {
    const fresh = latestById.get(candidate.camera.id);
    if (!fresh) return candidate;
    return { ...candidate, camera: {
      ...candidate.camera, ...fresh,
      enabled: candidate.camera.enabled, qualityWeight: candidate.camera.qualityWeight,
      notes: candidate.camera.notes, direction: candidate.camera.direction,
      viewAzimuth: candidate.camera.viewAzimuth ?? fresh.viewAzimuth,
      viewAzimuthSource: candidate.camera.viewAzimuthSource ?? fresh.viewAzimuthSource,
      discovery: candidate.camera.discovery,
    } };
  });
  const settled = await Promise.allSettled(refreshedCandidates.map((candidate) => rankCandidate(candidate, now)));
  const evaluations: CandidateDiagnostic[] = settled.map((result, index) => result.status === "fulfilled" ? result.value : {
    ...refreshedCandidates[index], visibility: "rejected-other", imageChecked: false, imageAnalyzed: false,
    reason: `Rejected: ${result.reason instanceof Error ? result.reason.message : "candidate check failed"}`,
  });
  const ranked = evaluations.flatMap((evaluation) => evaluation.scored && (evaluation.visibility === "visible" || evaluation.visibility === "featured") ? [evaluation.scored] : []);
  return { ranked, refreshed: latest.length, evaluations };
}

function buildDebug(date: Date, selectedIds: Set<string>, evaluations: CandidateDiagnostic[]): CameraDebugEntry[] {
  const byId = new Map(evaluations.map((evaluation) => [evaluation.camera.id, evaluation]));
  return cameras.map((camera) => {
    const position = getSolarPosition(date, camera.latitude, camera.longitude);
    const trend = getSolarTrend(date, camera.latitude, camera.longitude);
    const selected = selectedIds.has(camera.id);
    const inWindow = position.elevation >= SUNSET_WINDOWS.extended.minimumElevation && position.elevation <= SUNSET_WINDOWS.extended.maximumElevation;
    let reason = inWindow ? "Astronomical candidate; extended window not needed" : "outside extended sunset window";
    if (!camera.enabled) reason = "camera disabled";
    else if (!Number.isFinite(position.elevation)) reason = "invalid camera coordinates";
    else if (!trend.isSunSetting && inWindow) reason = trend.solarElevationTrend === "ascending" ? "sun rising, not setting" : "sun is not descending";
    else if (byId.has(camera.id)) reason = byId.get(camera.id)!.reason;
    return { cameraId: camera.id, name: camera.name, solarElevation: position.elevation, solarAzimuth: position.azimuth, ...trend, selected, reason };
  });
}

export async function createRanking(date = new Date()): Promise<RankingResponse> {
  const registryIsWindy = cameras.some((camera) => camera.source === "windy");
  let provider: WindyWebcamProvider | undefined;
  let providerError: string | undefined;
  if (registryIsWindy) {
    try { provider = new WindyWebcamProvider(); } catch (error) { providerError = error instanceof Error ? error.message : "Windy configuration failed."; }
  }
  const strictCandidates = getSunsetCandidates(cameras, date, "strict");
  const strict = await refreshAndRank(strictCandidates, date, provider);
  let results = strict.ranked;
  let refreshed = strict.refreshed;
  const candidateDiagnostics = [...strict.evaluations];
  let selectionStage: CandidateStage = "strict";
  if (results.length < MINIMUM_DESIRED_CANDIDATES) {
    selectionStage = "extended";
    const strictIds = new Set(strictCandidates.map(({ camera }) => camera.id));
    const extendedOnly = getSunsetCandidates(cameras, date, "extended").filter(({ camera }) => !strictIds.has(camera.id));
    const extended = await refreshAndRank(extendedOnly.map((candidate) => ({ ...candidate, stage: "extended" })), date, provider);
    results = [...results, ...extended.ranked];
    refreshed += extended.refreshed;
    candidateDiagnostics.push(...extended.evaluations);
  }
  results.sort((a, b) => b.finalScore - a.finalScore || b.sunsetOpportunityScore - a.sunsetOpportunityScore);
  const selectedIds = new Set(results.map(({ camera }) => camera.id));
  const featuredIds = new Set(candidateDiagnostics.filter((item) => item.visibility === "featured").map((item) => item.camera.id));
  const featuredCameraId = results.find((item) => featuredIds.has(item.camera.id))?.camera.id ?? null;
  const imagesChecked = candidateDiagnostics.filter((item) => item.imageChecked).length;
  const diagnostics = {
    astronomical: candidateDiagnostics.length,
    imagesAnalyzed: candidateDiagnostics.filter((item) => item.imageAnalyzed).length,
    visibleSunsets: results.length,
    rejectedEvidence: candidateDiagnostics.filter((item) => item.visibility === "rejected-evidence").length,
    rejectedOther: candidateDiagnostics.filter((item) => item.visibility === "rejected-other").length,
    featured: featuredIds.size,
  };
  console.info(`[ranking] registry=${cameras.length} ${Object.entries(diagnostics).map(([key, value]) => `${key}=${value}`).join(" ")} metadataRefreshed=${refreshed} imagesChecked=${imagesChecked}`);
  return {
    generatedAt: date.toISOString(), candidatesEvaluated: candidateDiagnostics.length, totalCameras: cameras.length,
    sunsetWindows: SUNSET_WINDOWS, selectionStage, minimumDesiredCandidates: MINIMUM_DESIRED_CANDIDATES,
    results, featuredCameraId, candidateDiagnostics, diagnostics, debug: buildDebug(date, selectedIds, candidateDiagnostics),
    provider: { mode: registryIsWindy ? "windy" : "mock", refreshed, imagesChecked, error: providerError },
  };
}
