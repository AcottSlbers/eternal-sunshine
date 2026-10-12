import digitraffic from "@/data/providers/digitraffic-review-3.7b.json";
import usgs from "@/data/providers/usgs-review-3.7b.json";
import type { Camera } from "@/types/camera";
import type { ProviderReviewFile } from "@/types/provider-review";

// Discovery files never enter runtime. Only explicit, completed visual reviews do.
export function approvedProviderCameras(review: ProviderReviewFile): Camera[] {
  const cap = review.provider === "usgs" ? 40 : 50;
  const seen = new Set<string>();
  return review.rows.flatMap((row): Camera[] => {
    const camera = row.camera;
    if (row.status !== "accepted" || !row.imageDecoded || !row.fresh || !row.daylightValidated || !row.horizonVerified
      || !camera || camera.source !== review.provider || row.id !== camera.id || !camera.id.startsWith(`${review.provider}:`)
      || !camera.enabled || camera.supportsVisualScoring !== true || camera.permanentlyRejected
      || (camera.usagePolicy !== "open-attribution" && camera.usagePolicy !== "open-commercial")
      || !camera.imageUrl || !camera.attribution || !Number.isFinite(camera.latitude) || Math.abs(camera.latitude) > 90
      || !Number.isFinite(camera.longitude) || Math.abs(camera.longitude) > 180
      || (camera.latitude === 0 && camera.longitude === 0) || seen.has(camera.id) || seen.size >= cap) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export const reviewedProviderCameras = [
  ...approvedProviderCameras(usgs as ProviderReviewFile),
  ...approvedProviderCameras(digitraffic as ProviderReviewFile),
];
