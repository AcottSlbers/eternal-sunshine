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
  notes?: string;
  discovery?: CameraDiscoveryMetadata;
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
