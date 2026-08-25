import camerasData from "@/data/cameras.json";
import { SUNSET_WINDOW } from "@/lib/config";
import { getSolarElevation, getSunsetCandidates, isSunDescending } from "@/lib/solar";
import { WindyWebcamProvider } from "@/lib/providers/windy-webcam-provider";
import type { Camera } from "@/types/camera";
import type { CameraDebugEntry, RankedSunset, RankingResponse, SunsetCandidate } from "@/types/ranking";

const cameras = camerasData as Camera[];

// Temporary Phase 1 score: proximity to the middle of the sunset window, adjusted by curated quality weight.
// It is deliberately not image analysis and must be replaced in Phase 4.
export function getTemporaryMockScore(candidate: SunsetCandidate): RankedSunset {
  const midpoint = (SUNSET_WINDOW.minimumElevation + SUNSET_WINDOW.maximumElevation) / 2;
  const halfRange = (SUNSET_WINDOW.maximumElevation - SUNSET_WINDOW.minimumElevation) / 2;
  const proximity = Math.max(0, 1 - Math.abs(candidate.solarElevation - midpoint) / halfRange);
  const score = Math.round(Math.min(100, (25 + proximity * 65) * candidate.camera.qualityWeight));

  return { ...candidate, sunsetScore: score, scoreKind: "temporary-mock", metrics: { solarWindowProximity: Math.round(proximity * 100), qualityWeight: candidate.camera.qualityWeight } };
}

function buildDebug(date: Date): CameraDebugEntry[] {
  return cameras.map((camera) => {
    const solarElevation = getSolarElevation(date, camera.latitude, camera.longitude);
    const descending = isSunDescending(date, camera.latitude, camera.longitude);
    const selected = camera.enabled && descending && solarElevation >= SUNSET_WINDOW.minimumElevation && solarElevation <= SUNSET_WINDOW.maximumElevation;
    let reason = "inside configured sunset window";
    if (!camera.enabled) reason = "camera disabled";
    else if (!Number.isFinite(solarElevation)) reason = "invalid camera coordinates";
    else if (!descending && solarElevation >= SUNSET_WINDOW.minimumElevation && solarElevation <= SUNSET_WINDOW.maximumElevation) reason = "sun rising, not setting";
    else if (solarElevation > SUNSET_WINDOW.maximumElevation) reason = "sun above sunset window";
    else if (solarElevation < SUNSET_WINDOW.minimumElevation) reason = "sun below sunset window";
    return { cameraId: camera.id, name: camera.name, solarElevation, selected, reason };
  });
}

export async function createRanking(date = new Date()): Promise<RankingResponse> {
  const candidates = getSunsetCandidates(cameras, date);
  const windyCandidates = candidates.filter(({ camera }) => camera.source === "windy");
  let refreshed = new Map<string, Camera>();
  let provider: RankingResponse["provider"] = { mode: windyCandidates.length > 0 ? "windy" : "mock", refreshed: 0 };
  if (windyCandidates.length > 0) {
    try {
      const latest = await new WindyWebcamProvider().getCameras(windyCandidates.map(({ camera }) => camera.id));
      refreshed = new Map(latest.map((camera) => [camera.id, camera]));
      provider.refreshed = latest.length;
    } catch (error) { provider = { ...provider, error: error instanceof Error ? error.message : "Windy refresh failed." }; }
  }
  const updatedCandidates = candidates.map((candidate) => ({ ...candidate, camera: refreshed.get(candidate.camera.id) ? { ...candidate.camera, ...refreshed.get(candidate.camera.id) } : candidate.camera }));
  const results = updatedCandidates.map(getTemporaryMockScore).sort((a, b) => a.solarElevation - b.solarElevation);
  console.info(`[ranking] registry=${cameras.length} sunsetCandidates=${candidates.length} windyMetadataRefreshed=${provider.refreshed}`);
  return { generatedAt: date.toISOString(), candidatesEvaluated: results.length, totalCameras: cameras.length, sunsetWindow: SUNSET_WINDOW, results, debug: buildDebug(date), provider };
}
