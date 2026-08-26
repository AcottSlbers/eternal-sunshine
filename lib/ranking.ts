import camerasData from "@/data/cameras.json";
import { MINIMUM_DESIRED_CANDIDATES, STALE_IMAGE_MINUTES, SUNSET_WINDOWS } from "@/lib/config";
import { getCameraDirection, getSunAlignmentScore } from "@/lib/camera-direction";
import { fetchImageViability, UNAVAILABLE_IMAGE_VIABILITY } from "@/lib/image-viability";
import { WindyWebcamProvider } from "@/lib/providers/windy-webcam-provider";
import { getSolarPosition, getSunsetCandidates, getSunsetPhaseScore, isSunDescending } from "@/lib/solar";
import { getCameraTimeZone } from "@/lib/time-zone";
import type { Camera } from "@/types/camera";
import type { CameraDebugEntry, CandidateStage, ImageViability, RankedSunset, RankingResponse, SunsetCandidate } from "@/types/ranking";

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

interface CandidateEvaluation { ranked: RankedSunset | null; imageChecked: boolean; rejection?: string }

async function rankCandidate(candidate: SunsetCandidate, now: Date): Promise<CandidateEvaluation> {
  const direction = getCameraDirection(candidate.camera);
  const alignment = getSunAlignmentScore(direction.viewAzimuth, candidate.solarAzimuth);
  if (alignment.difference !== undefined && alignment.difference > 120) return { ranked: null, imageChecked: false, rejection: `camera points ${alignment.difference.toFixed(0)}° away from the sun` };
  const freshness = getImageFreshness(candidate.camera.lastKnownImageTimestamp ?? candidate.camera.imageUpdatedAt, now);
  if (freshness.stale) return { ranked: null, imageChecked: false, rejection: `image is stale (${freshness.ageMinutes?.toFixed(0)} minutes old)` };
  const imageUrl = candidate.camera.lastKnownImageUrl ?? candidate.camera.imageUrl;
  const imageViability = imageUrl && candidate.camera.source === "windy" ? await fetchImageViability(imageUrl) : UNAVAILABLE_IMAGE_VIABILITY;
  const imageChecked = Boolean(imageUrl && candidate.camera.source === "windy");
  if (!imageViability.viable) return { ranked: null, imageChecked, rejection: imageViability.reason ?? "image viability check failed" };
  const sunsetPhaseScore = getSunsetPhaseScore(candidate.solarElevation);
  const sunsetOpportunityScore = getSunsetOpportunityScore({ sunsetPhaseScore, sunAlignmentScore: alignment.score, freshnessScore: freshness.score, imageViability, qualityWeight: candidate.camera.qualityWeight });
  return { ranked: {
    ...candidate, sunsetOpportunityScore, sunsetPhaseScore, sunAlignmentScore: alignment.score,
    alignmentDifference: alignment.difference, directionConfidence: direction.confidence, cameraViewAzimuth: direction.viewAzimuth,
    imageAgeMinutes: freshness.ageMinutes, freshnessScore: freshness.score, imageViability,
    cameraTimeZone: getCameraTimeZone(candidate.camera.latitude, candidate.camera.longitude),
    scoreKind: candidate.camera.source === "windy" ? "opportunity" : "temporary-mock",
    temporaryMockScore: candidate.camera.source === "mock" ? sunsetOpportunityScore : undefined,
  }, imageChecked };
}

async function refreshAndRank(
  input: SunsetCandidate[], now: Date, provider: WindyWebcamProvider | undefined,
): Promise<{ ranked: RankedSunset[]; refreshed: number; imagesChecked: number; rejections: Map<string, string> }> {
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
  const evaluations = settled.map((result) => result.status === "fulfilled" ? result.value : { ranked: null, imageChecked: false, rejection: result.reason instanceof Error ? result.reason.message : "candidate check failed" });
  const ranked = evaluations.flatMap((evaluation) => evaluation.ranked ? [evaluation.ranked] : []);
  const rejections = new Map(evaluations.flatMap((evaluation, index) => evaluation.rejection ? [[refreshedCandidates[index].camera.id, evaluation.rejection] as const] : []));
  return { ranked, refreshed: latest.length, imagesChecked: evaluations.filter((evaluation) => evaluation.imageChecked).length, rejections };
}

function buildDebug(date: Date, selectedIds: Set<string>, rejections: Map<string, string>): CameraDebugEntry[] {
  return cameras.map((camera) => {
    const position = getSolarPosition(date, camera.latitude, camera.longitude);
    const descending = isSunDescending(date, camera.latitude, camera.longitude);
    const selected = selectedIds.has(camera.id);
    let reason = selected ? "selected after opportunity checks" : "outside extended sunset window";
    if (!camera.enabled) reason = "camera disabled";
    else if (!Number.isFinite(position.elevation)) reason = "invalid camera coordinates";
    else if (!descending && position.elevation >= SUNSET_WINDOWS.extended.minimumElevation && position.elevation <= SUNSET_WINDOWS.extended.maximumElevation) reason = "sun rising, not setting";
    else if (rejections.has(camera.id)) reason = rejections.get(camera.id)!;
    return { cameraId: camera.id, name: camera.name, solarElevation: position.elevation, solarAzimuth: position.azimuth, selected, reason };
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
  let imagesChecked = strict.imagesChecked;
  const rejections = new Map(strict.rejections);
  let selectionStage: CandidateStage = "strict";
  if (results.length < MINIMUM_DESIRED_CANDIDATES) {
    selectionStage = "extended";
    const strictIds = new Set(strictCandidates.map(({ camera }) => camera.id));
    const extendedOnly = getSunsetCandidates(cameras, date, "extended").filter(({ camera }) => !strictIds.has(camera.id));
    const extended = await refreshAndRank(extendedOnly.map((candidate) => ({ ...candidate, stage: "extended" })), date, provider);
    results = [...results, ...extended.ranked];
    refreshed += extended.refreshed;
    imagesChecked += extended.imagesChecked;
    extended.rejections.forEach((reason, id) => rejections.set(id, reason));
  }
  results.sort((a, b) => b.sunsetOpportunityScore - a.sunsetOpportunityScore);
  const selectedIds = new Set(results.map(({ camera }) => camera.id));
  console.info(`[ranking] registry=${cameras.length} strict=${strictCandidates.length} selected=${results.length} metadataRefreshed=${refreshed} imagesChecked=${imagesChecked}`);
  return {
    generatedAt: date.toISOString(), candidatesEvaluated: results.length, totalCameras: cameras.length,
    sunsetWindows: SUNSET_WINDOWS, selectionStage, minimumDesiredCandidates: MINIMUM_DESIRED_CANDIDATES,
    results, debug: buildDebug(date, selectedIds, rejections),
    provider: { mode: registryIsWindy ? "windy" : "mock", refreshed, imagesChecked, error: providerError },
  };
}
