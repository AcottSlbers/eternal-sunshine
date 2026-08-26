import type { Camera, CameraCandidateScore } from "@/types/camera";
import { CAMERAS_PER_BUCKET, LONGITUDE_BUCKET_COUNT, TARGET_CAMERA_COUNT } from "@/lib/config";

export { CAMERAS_PER_BUCKET, LONGITUDE_BUCKET_COUNT, TARGET_CAMERA_COUNT };
export const SCENIC_TERMS = ["beach", "coast", "ocean", "landscape", "lake", "mountain", "harbor", "harbour", "scenic", "island", "bay"];
const UNSUITABLE_TERMS = ["indoor", "traffic", "parking", "tunnel", "intersection", "industrial", "lift"];

export function getLongitudeBucket(longitude: number): number {
  return Math.min(LONGITUDE_BUCKET_COUNT - 1, Math.max(0, Math.floor((longitude + 180) / (360 / LONGITUDE_BUCKET_COUNT))));
}

export function scoreCameraCandidate(camera: Camera, now = new Date()): CameraCandidateScore {
  const text = `${camera.name} ${(camera.categories ?? []).join(" ")}`.toLowerCase();
  const ageHours = camera.lastKnownImageTimestamp ? (now.getTime() - Date.parse(camera.lastKnownImageTimestamp)) / 3_600_000 : Number.POSITIVE_INFINITY;
  const viewCount = camera.discovery?.viewCount ?? 0;
  const pixels = (camera.discovery?.imageWidth ?? 0) * (camera.discovery?.imageHeight ?? 0);
  const parts = {
    active: camera.enabled ? 25 : 0,
    currentImage: camera.lastKnownImageUrl ? 20 : 0,
    freshness: ageHours <= 1 ? 20 : ageHours <= 24 ? 12 : ageHours <= 168 ? 4 : 0,
    scenicCategory: SCENIC_TERMS.some((term) => text.includes(term)) ? 20 : 0,
    popularity: Math.min(10, Math.log10(viewCount + 1) * 2),
    resolution: pixels >= 640 * 360 ? 5 : pixels > 0 ? 2 : 0,
    unsuitablePenalty: UNSUITABLE_TERMS.some((term) => text.includes(term)) ? -30 : 0,
  };
  return { ...parts, total: Math.round((Object.values(parts).reduce((sum, value) => sum + value, 0)) * 100) / 100 };
}

export function selectDistributedPool(candidates: Camera[], perBucket = CAMERAS_PER_BUCKET): Camera[] {
  const unique = [...new Map(candidates.map((camera) => [camera.id, camera])).values()];
  const selected: Camera[] = [];
  for (let bucket = 0; bucket < LONGITUDE_BUCKET_COUNT; bucket += 1) {
    const available = unique.filter((camera) => getLongitudeBucket(camera.longitude) === bucket && camera.enabled && camera.lastKnownImageUrl);
    const chosen: Camera[] = [];
    while (chosen.length < perBucket && available.length > 0) {
      const ranked = available.map((camera) => {
        const countries = new Set(chosen.map((item) => item.country).filter(Boolean));
        const regions = new Set(chosen.map((item) => item.region).filter(Boolean));
        const minimumLatitudeDistance = chosen.length === 0 ? 90 : Math.min(...chosen.map((item) => Math.abs(item.latitude - camera.latitude)));
        const diversityBonus = (camera.country && !countries.has(camera.country) ? 15 : 0) + (camera.region && !regions.has(camera.region) ? 8 : 0) + Math.min(20, minimumLatitudeDistance / 3);
        return { camera, score: (camera.discovery?.candidateScore.total ?? 0) + diversityBonus };
      }).sort((a, b) => b.score - a.score);
      const next = ranked[0].camera;
      chosen.push(next);
      available.splice(available.findIndex((camera) => camera.id === next.id), 1);
    }
    selected.push(...chosen);
  }
  return selected;
}
