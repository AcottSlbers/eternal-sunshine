import { HERO_SWITCH_MIN_SCORE_GAIN, PUBLIC_RANKING_DEDUPE_RADIUS_KM, STALE_IMAGE_MINUTES } from "@/lib/config";
import { classifySunsetVisibility } from "@/lib/sunset-visibility";
import type { Camera } from "@/types/camera";
import type { HeroDecision, NearbySuppression, RankedSunset } from "@/types/ranking";

export function compareSunsets(a: RankedSunset, b: RankedSunset): number {
  return b.finalScore - a.finalScore || b.sunsetOpportunityScore - a.sunsetOpportunityScore
    || (a.camera.id < b.camera.id ? -1 : a.camera.id > b.camera.id ? 1 : 0);
}

export function cameraDistanceKm(a: Pick<Camera, "latitude" | "longitude">, b: Pick<Camera, "latitude" | "longitude">): number {
  const radians = Math.PI / 180;
  const haversine = Math.sin((b.latitude - a.latitude) * radians / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians)
    * Math.sin((b.longitude - a.longitude) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

export function deduplicatePublicRanking(visible: RankedSunset[], radiusKm = PUBLIC_RANKING_DEDUPE_RADIUS_KM) {
  const results: RankedSunset[] = [];
  const suppressed: NearbySuppression[] = [];
  // Greedy selection against retained cameras avoids collapsing whole chains of distant locations.
  for (const candidate of [...visible].sort(compareSunsets)) {
    const neighbor = results.find((kept) => cameraDistanceKm(candidate.camera, kept.camera) <= radiusKm);
    if (neighbor) {
      suppressed.push({ cameraId: candidate.camera.id, keptCameraId: neighbor.camera.id,
        distanceKm: Math.round(cameraDistanceKm(candidate.camera, neighbor.camera) * 100) / 100,
        reason: "suppressed: nearby higher-ranked camera" });
    } else results.push(candidate);
  }
  return { results, suppressed };
}

function isFreshFeatured(item: RankedSunset, now: Date): boolean {
  const timestamp = item.camera.lastKnownImageTimestamp ?? item.camera.imageUpdatedAt;
  const age = timestamp ? (now.getTime() - Date.parse(timestamp)) / 60_000 : item.imageAgeMinutes;
  return classifySunsetVisibility(item).visibility === "featured" && Number.isFinite(item.finalScore)
    && age !== undefined && Number.isFinite(age) && age <= STALE_IMAGE_MINUTES;
}

export function createHeroSelector(minScoreGain = HERO_SWITCH_MIN_SCORE_GAIN) {
  let previousCameraId: string | null = null;
  let lastEvaluatedAt = -Infinity;
  return (visible: RankedSunset[], now: Date): { featuredSunset: RankedSunset | null; heroDecision: HeroDecision } => {
    // Revalidate using this refresh's images and scores, never a retained camera snapshot.
    const eligible = visible.filter((item) => isFreshFeatured(item, now)).sort(compareSunsets);
    const best = eligible[0] ?? null;
    const current = eligible.find((item) => item.camera.id === previousCameraId);
    const gain = best && current ? Math.round((best.finalScore - current.finalScore) * 10) / 10 : Infinity;
    const featuredSunset = current && best && (current.camera.id === best.camera.id || gain < minScoreGain) ? current : best;
    const reason = !best ? "No fresh featured candidate"
      : !current ? "Selected best fresh featured candidate; previous hero absent or ineligible"
      : featuredSunset?.camera.id === current.camera.id ? "Retained valid hero; no challenger reaches minimum score gain"
      : "Challenger reaches minimum score gain";
    const heroDecision = { previousCameraId, cameraId: featuredSunset?.camera.id ?? null, reason };
    // An older overlapping request must not overwrite a newer runtime selection.
    if (now.getTime() >= lastEvaluatedAt) {
      previousCameraId = heroDecision.cameraId;
      lastEvaluatedAt = now.getTime();
    }
    return { featuredSunset, heroDecision };
  };
}

// Share lightweight state across server route modules. Restarts reset it; no images are retained.
const runtime = globalThis as typeof globalThis & { eternalSunshineHeroSelector?: ReturnType<typeof createHeroSelector> };
export const selectRuntimeHero = runtime.eternalSunshineHeroSelector ??= createHeroSelector();
