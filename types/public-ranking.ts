import type { CameraAttribution, CameraLivePlayer, CameraSource } from "@/types/camera";

export interface PublicSunset {
  camera: {
    id: string;
    name: string;
    country?: string;
    region?: string;
    source: CameraSource;
    attribution?: CameraAttribution;
    sourceUrl?: string;
    providerUrl?: string;
    hasLiveStream: boolean;
    livePlayer?: CameraLivePlayer;
    previewUrl?: string;
  };
  sunsetScore: number;
  sunsetStrength: string;
  imageAgeMinutes?: number;
  cameraTimeZone?: string;
}

export interface PublicRankingResponse {
  generatedAt: string;
  totalCameras: number;
  visibleCount: number;
  rankedHero: PublicSunset | null;
  results: PublicSunset[];
}
