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

export interface SunsetScoreMetrics {
  upperSkyWarmShare: number;
  horizonWarmShare: number;
  upperSkyPinkPurpleShare: number;
  horizonPinkPurpleShare: number;
  foregroundSunsetColorShare: number;
  sunsetColorConcentration: number;
  localizedSunsetPresence: number;
  sunsetColorDiversity: number;
  sunsetColorStrength: number;
  horizonGlow: number;
  chromaticDifference: number;
  chromaticHorizonCoherence: number;
  luminanceContrast: number;
  dynamicRange: number;
  textureEnhancement: number;
  averageLuminance: number;
  grayscaleShare: number;
  darkPixelShare: number;
  overexposedShare: number;
  foregroundWarmPenalty: number;
  astronomicalPlausibility: number;
  evidenceGateCeiling: number;
}

export interface VisualSunsetScore {
  sunsetEvidenceScore: number;
  sunsetBeautyScore: number;
  sunsetScore: number;
  metrics: SunsetScoreMetrics;
  status: "analyzed" | "unavailable";
  reason?: string;
}

export interface SolarTrend {
  solarElevationLater: number;
  solarTrendDegreesPerMinute: number;
  solarElevationTrend: "descending" | "ascending" | "stationary" | "invalid";
  isSunSetting: boolean;
}

export interface SunsetCandidate extends SolarTrend {
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
  sunsetEvidenceScore: number;
  sunsetBeautyScore: number;
  sunsetScore: number;
  finalScore: number;
  sunsetMetrics: SunsetScoreMetrics;
  visualScoreStatus: VisualSunsetScore["status"];
  cameraTimeZone?: string;
  scoreKind: "visual" | "temporary-mock";
  temporaryMockScore?: number;
}

export type SunsetVisibility = "rejected-evidence" | "rejected-other" | "visible" | "featured";

export interface CandidateDiagnostic extends SunsetCandidate {
  visibility: SunsetVisibility;
  reason: string;
  imageChecked: boolean;
  imageAnalyzed: boolean;
  scored?: RankedSunset;
}

export interface RankingDiagnostics {
  astronomical: number;
  imagesAnalyzed: number;
  visibleSunsets: number;
  rejectedEvidence: number;
  rejectedOther: number;
  featured: number;
}

export interface CameraDebugEntry extends SolarTrend {
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
  featuredCameraId: string | null;
  candidateDiagnostics: CandidateDiagnostic[];
  diagnostics: RankingDiagnostics;
  debug: CameraDebugEntry[];
  provider: { mode: "mock" | "windy"; refreshed: number; imagesChecked: number; error?: string };
}
