import type { Camera } from "@/types/camera";
import type { DirectionConfidence } from "@/types/ranking";

const DIRECTIONS: Record<string, number> = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };

export function normalizeViewAzimuth(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function inferViewAzimuth(name: string): number | undefined {
  const numeric = name.match(/(?:->|›|>)\s*(\d{1,3}(?:\.\d+)?)\s*(?:deg|°)/i);
  if (numeric) return normalizeViewAzimuth(Number(numeric[1]));
  const match = name.toLowerCase().match(/(?:^|[›>])\s*(north[ -]?east|south[ -]?east|south[ -]?west|north[ -]?west|north|east|south|west)\s*(?::|$)/i);
  return match ? DIRECTIONS[match[1].replace(/[ -]/g, "")] : undefined;
}

export function getCameraDirection(camera: Camera): { viewAzimuth?: number; confidence: DirectionConfidence } {
  const manual = camera.manualViewAzimuth;
  if (typeof manual === "number" && Number.isFinite(manual)) return { viewAzimuth: normalizeViewAzimuth(manual), confidence: "manual" };
  const curated = camera.viewAzimuth ?? camera.direction;
  if (typeof curated === "number" && Number.isFinite(curated)) {
    const confidence = camera.manualDirectionConfidence ?? camera.directionConfidence ?? (camera.viewAzimuthSource === "name-inferred" ? "inferred" : "manual");
    return { viewAzimuth: normalizeViewAzimuth(curated), confidence };
  }
  const inferred = inferViewAzimuth(camera.name);
  return inferred === undefined ? { confidence: "unknown" } : { viewAzimuth: inferred, confidence: "inferred" };
}

export function getAngularDifference(first: number, second: number): number {
  const difference = Math.abs(normalizeViewAzimuth(first) - normalizeViewAzimuth(second));
  return Math.min(difference, 360 - difference);
}

export function getSunAlignmentScore(viewAzimuth: number | undefined, solarAzimuth: number): { score: number; difference?: number } {
  if (viewAzimuth === undefined || !Number.isFinite(solarAzimuth)) return { score: 65 };
  const difference = getAngularDifference(viewAzimuth, solarAzimuth);
  const points: Array<[number, number]> = [[0, 100], [20, 90], [40, 70], [60, 40], [80, 12], [100, 3], [120, 1], [180, 0]];
  const upperIndex = points.findIndex(([angle]) => difference <= angle);
  if (upperIndex === 0) return { score: points[0][1], difference };
  const [lowerAngle, lowerScore] = points[upperIndex - 1];
  const [upperAngle, upperScore] = points[upperIndex];
  const progress = (difference - lowerAngle) / (upperAngle - lowerAngle);
  const easedProgress = progress * progress * (3 - 2 * progress);
  return { score: Math.round((lowerScore + (upperScore - lowerScore) * easedProgress) * 10) / 10, difference };
}

export function formatDirection(azimuth: number | undefined): string {
  if (azimuth === undefined) return "Unknown";
  const labels = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];
  return labels[Math.round(normalizeViewAzimuth(azimuth) / 45) % 8];
}
