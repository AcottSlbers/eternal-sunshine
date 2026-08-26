export interface Camera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  source: "mock" | "windy";
  sourceUrl?: string;
  imageUrl?: string;
  imageUpdatedAt?: string;
  lastKnownImageUrl?: string;
  lastKnownImageTimestamp?: string;
  categories?: string[];
  enabled: boolean;
  qualityWeight: number;
  direction?: number;
  viewAzimuth?: number;
  viewAzimuthSource?: "curated" | "name-inferred";
  directionConfidence?: "manual" | "metadata" | "inferred" | "unknown";
  manualQualityOverride?: number;
  manualViewAzimuth?: number;
  manualDirectionConfidence?: "manual" | "metadata" | "inferred" | "unknown";
  permanentlyRejected?: boolean;
  notes?: string;
  discovery?: CameraDiscoveryMetadata;
  review?: CameraReviewMetadata;
}

export interface CameraImageQuality {
  skyShare: number;
  openComposition: number;
  edgeDensity: number;
  artificialLightRatio: number;
  score: number;
  status: "analyzed" | "unavailable";
  reason?: string;
}

export interface CameraQualityMetrics {
  score: number;
  metadataScore: number;
  scenicScore: number;
  freshnessReliability: number;
  directionScore: number;
  resolutionScore: number;
  categoryPenalty: number;
  image?: CameraImageQuality;
  imageTimestamp?: string;
  analyzedAt: string;
}

export interface CameraCoverageSummary {
  strictSlotCount: number;
  extendedSlotCount: number;
  representativeDates: number;
}

export interface CameraReviewMetadata {
  quality: CameraQualityMetrics;
  coverage: CameraCoverageSummary;
  coverageContributionScore?: number;
  selectionRank?: number;
}

export interface CameraCandidateScore {
  total: number;
  active: number;
  currentImage: number;
  freshness: number;
  scenicCategory: number;
  popularity: number;
  resolution: number;
  unsuitablePenalty: number;
}

export interface CameraDiscoveryMetadata {
  longitudeBucket: number;
  viewCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  candidateScore: CameraCandidateScore;
  discoveredAt: string;
}
