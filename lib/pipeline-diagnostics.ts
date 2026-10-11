import { MIN_VISIBLE_SUNSET_EVIDENCE, MIN_VISIBLE_SUNSET_SCORE, STALE_IMAGE_MINUTES } from "@/lib/config";
import { getSunsetStrength } from "@/lib/sunset-strength";
import { getSunsetPhaseScore } from "@/lib/solar";
import type { CandidateDiagnostic, RankingResponse } from "@/types/ranking";

export function describeCandidate(item: CandidateDiagnostic, generatedAt: string) {
  const s = item.scored;
  const timestamp = item.camera.lastKnownImageTimestamp ?? item.camera.imageUpdatedAt;
  const age = timestamp ? (Date.parse(generatedAt) - Date.parse(timestamp)) / 60_000 : undefined;
  return {
    cameraId: item.camera.id, provider: item.camera.source, location: item.camera.name,
    evidence: s?.sunsetEvidenceScore ?? null, beauty: s?.sunsetBeautyScore ?? null,
    sunsetScore: s?.sunsetScore ?? null, finalScore: s?.finalScore ?? null,
    solarElevation: item.solarElevation, sunsetPhase: getSunsetPhaseScore(item.solarElevation),
    imageAgeMinutes: age !== undefined && Number.isFinite(age) ? Math.max(0, Math.round(age * 10) / 10) : null,
    visibility: item.visibility, reason: item.reason,
    primaryEvidencePath: s?.primaryEvidencePath ?? "none", isCredibleSunset: s?.isCredibleSunset ?? false,
    credibleSunsetReason: s?.credibleSunsetReason ?? item.reason,
    strength: s ? getSunsetStrength(s.sunsetScore) : "not visible",
    metrics: s?.sunsetMetrics ?? null,
  };
}

export function getPipelineDiagnostics(ranking: RankingResponse) {
  const window = ranking.sunsetWindows.extended;
  const inWindow = ranking.debug.filter(item => item.reason !== "camera disabled" && Number.isFinite(item.solarElevation)
    && item.solarElevation >= window.minimumElevation && item.solarElevation <= window.maximumElevation);
  const evaluated = ranking.candidateDiagnostics;
  const analyzed = evaluated.filter(item => item.imageAnalyzed && item.scored);
  const viable = analyzed.filter(item => item.scored?.imageViability.status === "viable" && item.scored.imageViability.viable);
  const evidence = viable.filter(item => item.scored!.sunsetEvidenceScore >= MIN_VISIBLE_SUNSET_EVIDENCE);
  const visual = evidence.filter(item => item.scored!.sunsetScore >= MIN_VISIBLE_SUNSET_SCORE);
  const described = evaluated.map(item => describeCandidate(item, ranking.generatedAt));
  const directionPassed = described.filter(item => !item.reason.startsWith("Rejected: camera points"));
  const rejected = described.filter(item => item.visibility.startsWith("rejected") && item.metrics)
    .sort((a, b) => (b.sunsetScore ?? 0) - (a.sunsetScore ?? 0) || (b.beauty ?? 0) - (a.beauty ?? 0) || a.cameraId.localeCompare(b.cameraId));
  return {
    counts: {
      registry: ranking.totalCameras, astronomical: inWindow.length,
      descendingSun: inWindow.filter(item => item.isSunSetting).length, evaluated: evaluated.length,
      metadataFresh: described.filter(item => item.imageAgeMinutes !== null && item.imageAgeMinutes <= STALE_IMAGE_MINUTES).length,
      metadataUnknownOrStale: described.filter(item => item.imageAgeMinutes === null || item.imageAgeMinutes > STALE_IMAGE_MINUTES).length,
      rejectedDirection: evaluated.filter(item => item.reason.startsWith("Rejected: camera points")).length,
      directionPassed: directionPassed.length,
      metadataFreshAfterDirection: directionPassed.filter(item => item.imageAgeMinutes !== null && item.imageAgeMinutes <= STALE_IMAGE_MINUTES).length,
      imagesAnalyzed: analyzed.length, imageViable: viable.length,
      evidencePassed: evidence.length, sunsetScorePassed: visual.length,
      highConfidenceAlternatives: viable.filter(item => item.scored!.isCredibleSunset && item.scored!.sunsetEvidenceScore < MIN_VISIBLE_SUNSET_EVIDENCE).length,
      credibleSunsets: evaluated.filter(item => item.scored?.isCredibleSunset).length,
      visibleSunsets: ranking.diagnostics.visibleSunsets, featuredSunsets: ranking.diagnostics.featured,
      publicRanked: ranking.results.length, heroSelected: Number(ranking.featuredSunset !== null),
    },
    rejectedAnalyzed: rejected, topRejected: rejected.slice(0, 10),
    credible: described.filter(item => item.isCredibleSunset).sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
  };
}
