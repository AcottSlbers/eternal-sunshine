import type { Camera, CameraCandidateScore } from "@/types/camera";

export const LONGITUDE_BUCKET_COUNT = 24;
export const CAMERAS_PER_BUCKET = 4;
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
    const bucketCameras = unique.filter((camera) => getLongitudeBucket(camera.longitude) === bucket && camera.enabled && camera.lastKnownImageUrl)
      .sort((a, b) => (b.discovery?.candidateScore.total ?? 0) - (a.discovery?.candidateScore.total ?? 0));
    const latitudeBands = [-90, -30, 0, 30, 90];
    const diverse = latitudeBands.slice(0, -1).flatMap((minimum, index) => {
      const maximum = latitudeBands[index + 1];
      const found = bucketCameras.find((camera) => camera.latitude >= minimum && camera.latitude < maximum && !selected.some((item) => item.id === camera.id));
      return found ? [found] : [];
    });
    const fill = bucketCameras.filter((camera) => !diverse.some((item) => item.id === camera.id)).slice(0, Math.max(0, perBucket - diverse.length));
    selected.push(...diverse.slice(0, perBucket), ...fill);
  }
  return selected;
}
