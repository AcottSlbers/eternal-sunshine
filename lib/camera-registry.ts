import windy from "@/data/cameras.json";
import meteogalicia from "@/data/meteogalicia-cameras.json";
import type { Camera } from "@/types/camera";

// The imported regional registry survives independent Windy Gold rebuilds.
export const cameraRegistry: Camera[] = [...windy, ...meteogalicia] as Camera[];

export function mergeImportedCameras(existing: Camera[], incoming: Camera[]): Camera[] {
  const previous = new Map(existing.map((camera) => [camera.id, camera]));
  const merged = incoming.map((camera) => {
    const old = previous.get(camera.id);
    if (!old) return camera;
    return { ...old, ...camera, enabled: old.enabled, qualityWeight: old.qualityWeight,
      direction: old.direction, directionConfidence: old.directionConfidence ?? camera.directionConfidence,
      viewAzimuth: old.viewAzimuth, viewAzimuthSource: old.viewAzimuthSource,
      manualViewAzimuth: old.manualViewAzimuth, manualDirectionConfidence: old.manualDirectionConfidence,
      manualQualityOverride: old.manualQualityOverride, permanentlyRejected: old.permanentlyRejected,
      notes: old.notes, categories: old.categories ?? camera.categories };
  });
  const ids = new Set(incoming.map((camera) => camera.id));
  return [...merged, ...existing.filter((camera) => !ids.has(camera.id))];
}
