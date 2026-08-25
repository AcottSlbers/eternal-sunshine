import type { Camera } from "@/types/camera";

export interface SunsetCandidate {
  camera: Camera;
  solarElevation: number;
}

export interface RankedSunset extends SunsetCandidate {
  sunsetScore: number;
  metrics: Record<string, number>;
  scoreKind: "temporary-mock";
}

export interface CameraDebugEntry {
  cameraId: string;
  name: string;
  solarElevation: number;
  selected: boolean;
  reason: string;
}

export interface RankingResponse {
  generatedAt: string;
  candidatesEvaluated: number;
  totalCameras: number;
  sunsetWindow: { minimumElevation: number; maximumElevation: number };
  results: RankedSunset[];
  debug: CameraDebugEntry[];
  provider: { mode: "mock" | "windy"; refreshed: number; error?: string };
}
