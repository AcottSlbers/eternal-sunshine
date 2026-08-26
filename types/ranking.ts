import type { Camera } from "@/types/camera";

export type CandidateStage = "strict" | "extended";
export type DirectionConfidence = "manual" | "metadata" | "inferred" | "unknown";

export interface ImageViability {
  brightness: number;
  saturation: number;
  darkPixelRatio: number;
  blueGrayRatio: number;
  viable: boolean;
  status: "viable" | "rejected" | "unavailable";
  reason?: string;
}

export interface SunsetCandidate {
  camera: Camera;
  solarElevation: number;
  solarAzimuth: number;
  stage: CandidateStage;
}

export interface RankedSunset extends SunsetCandidate {
  sunsetOpportunityScore: number;
  sunsetPhaseScore: number;
  sunAlignmentScore: number;
  alignmentDifference?: number;
  directionConfidence: DirectionConfidence;
  cameraViewAzimuth?: number;
  imageAgeMinutes?: number;
  freshnessScore: number;
  imageViability: ImageViability;
  cameraTimeZone?: string;
  scoreKind: "opportunity" | "temporary-mock";
  temporaryMockScore?: number;
}

export interface CameraDebugEntry {
  cameraId: string;
  name: string;
  solarElevation: number;
  solarAzimuth: number;
  selected: boolean;
  reason: string;
}

export interface RankingResponse {
  generatedAt: string;
  candidatesEvaluated: number;
  totalCameras: number;
  sunsetWindows: {
    strict: { minimumElevation: number; maximumElevation: number };
    extended: { minimumElevation: number; maximumElevation: number };
  };
  selectionStage: CandidateStage;
  minimumDesiredCandidates: number;
  results: RankedSunset[];
  debug: CameraDebugEntry[];
  provider: { mode: "mock" | "windy"; refreshed: number; imagesChecked: number; error?: string };
}
