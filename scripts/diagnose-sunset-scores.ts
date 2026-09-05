import path from "node:path";
import dotenv from "dotenv";
import { compareSunsets } from "../lib/public-ranking";
import { HERO_SWITCH_MIN_SCORE_GAIN, PUBLIC_RANKING_DEDUPE_RADIUS_KM } from "../lib/config";
import type { RankedSunset } from "../types/ranking";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

async function main() {
  const { createRanking } = await import("../lib/ranking");
  const ranking = await createRanking();
  const visible = ranking.candidateDiagnostics.flatMap((item) => item.scored && (item.visibility === "visible" || item.visibility === "featured") ? [item.scored] : []).sort(compareSunsets);
  const scores = visible.map((result) => result.sunsetScore).sort((first, second) => first - second);
  const summarize = (result: RankedSunset) => ({
    cameraId: result.camera.id, cameraName: result.camera.name,
    latitude: result.camera.latitude, longitude: result.camera.longitude,
    sunsetEvidenceScore: result.sunsetEvidenceScore, sunsetBeautyScore: result.sunsetBeautyScore,
    sunsetScore: result.sunsetScore, finalScore: result.finalScore,
  });
  const top = ranking.results[0];
  console.log(JSON.stringify({
    generatedAt: ranking.generatedAt,
    candidateCount: ranking.results.length,
    diagnostics: ranking.diagnostics,
    featuredCameraId: ranking.featuredCameraId,
    hero: ranking.featuredSunset ? summarize(ranking.featuredSunset) : null,
    heroDecision: ranking.heroDecision,
    dedupeRadiusKm: PUBLIC_RANKING_DEDUPE_RADIUS_KM,
    heroSwitchMinScoreGain: HERO_SWITCH_MIN_SCORE_GAIN,
    beforeDedupe: visible.map(summarize),
    afterDedupe: ranking.results.map(summarize),
    suppressedNearby: ranking.candidateDiagnostics.filter((item) => item.suppression).map((item) => ({
      ...item.suppression, cameraName: item.camera.name, finalScore: item.scored?.finalScore,
      keptCameraName: ranking.results.find((result) => result.camera.id === item.suppression?.keptCameraId)?.camera.name,
    })),
    distribution: {
      population: "visible sunsets before geographic dedupe",
      minimum: scores[0] ?? null,
      median: scores.length ? Math.round(median(scores) * 10) / 10 : null,
      maximum: scores.at(-1) ?? null,
    },
    topRankedImage: top ? {
      cameraId: top.camera.id, cameraName: top.camera.name, imageUrl: top.camera.lastKnownImageUrl ?? top.camera.imageUrl,
      sunsetEvidenceScore: top.sunsetEvidenceScore, sunsetBeautyScore: top.sunsetBeautyScore,
      sunsetScore: top.sunsetScore, finalScore: top.finalScore,
    } : null,
    candidates: ranking.results.map((result) => ({
      cameraId: result.camera.id, cameraName: result.camera.name,
      sunsetEvidenceScore: result.sunsetEvidenceScore, sunsetBeautyScore: result.sunsetBeautyScore,
      sunsetScore: result.sunsetScore, finalScore: result.finalScore,
    })),
    rejectedCandidates: ranking.candidateDiagnostics.filter((item) => item.visibility.startsWith("rejected")).map((item) => ({
      cameraId: item.camera.id, cameraName: item.camera.name, reason: item.reason,
      solarElevation: item.solarElevation, solarElevationTrend: item.solarElevationTrend,
      solarTrendDegreesPerMinute: item.solarTrendDegreesPerMinute,
      sunsetEvidenceScore: item.scored?.sunsetEvidenceScore ?? null,
      sunsetScore: item.scored?.sunsetScore ?? null, finalScore: item.scored?.finalScore ?? null,
    })),
    requests: ranking.provider,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
