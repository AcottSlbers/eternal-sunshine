import type { Camera } from "./camera";

export type ReviewedProvider = "usgs" | "digitraffic";
export type ProviderReviewStatus = "accepted" | "pending-manual-review" | "rejected-no-coordinates"
  | "rejected-no-image" | "rejected-night-only/insufficient-validation" | "rejected-poor-horizon"
  | "rejected-road/foreground" | "rejected-stale" | "rejected-rights-unverified";

export interface ProviderCameraReview {
  id: string;
  status: ProviderReviewStatus;
  reason: string;
  camera: Camera | null;
  imageAttempted: boolean;
  imageDecoded: boolean;
  fresh: boolean;
  ageMinutes?: number;
  solarElevation?: number;
  daylightValidated: boolean;
  horizonVerified: boolean;
  normalizedSkyArea?: number;
  horizonConfidence?: number;
  imageFingerprint?: string;
}

export interface ProviderReviewFile {
  provider: ReviewedProvider;
  generatedAt: string;
  sampleLimit: number;
  imageRequests: number;
  rows: ProviderCameraReview[];
}
