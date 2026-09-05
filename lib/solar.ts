import SunCalc from "suncalc";
import { SOLAR_TREND_MINUTES, SUNSET_WINDOWS } from "@/lib/config";
import type { Camera } from "@/types/camera";
import type { CandidateStage, SolarTrend, SunsetCandidate } from "@/types/ranking";

const RADIANS_TO_DEGREES = 180 / Math.PI;

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function getSolarPosition(date: Date, latitude: number, longitude: number): { elevation: number; azimuth: number } {
  if (!validCoordinates(latitude, longitude)) return { elevation: Number.NaN, azimuth: Number.NaN };
  const position = SunCalc.getPosition(date, latitude, longitude);
  // SunCalc measures azimuth from south toward west. Add 180° for north-clockwise degrees.
  return { elevation: position.altitude * RADIANS_TO_DEGREES, azimuth: normalizeDegrees(position.azimuth * RADIANS_TO_DEGREES + 180) };
}

export function getSolarElevation(date: Date, latitude: number, longitude: number): number {
  return getSolarPosition(date, latitude, longitude).elevation;
}

export function getSolarAzimuth(date: Date, latitude: number, longitude: number): number {
  return getSolarPosition(date, latitude, longitude).azimuth;
}

export function isElevationInWindow(elevation: number, stage: CandidateStage): boolean {
  const window = SUNSET_WINDOWS[stage];
  return Number.isFinite(elevation) && elevation >= window.minimumElevation && elevation <= window.maximumElevation;
}

export function isSunsetElevation(elevation: number): boolean {
  return isElevationInWindow(elevation, "extended");
}

export function isSunDescending(date: Date, latitude: number, longitude: number): boolean {
  return getSolarTrend(date, latitude, longitude).isSunSetting;
}

export function getSolarTrend(date: Date, latitude: number, longitude: number): SolarTrend {
  const current = getSolarElevation(date, latitude, longitude);
  const solarElevationLater = getSolarElevation(new Date(date.getTime() + SOLAR_TREND_MINUTES * 60_000), latitude, longitude);
  const solarTrendDegreesPerMinute = (solarElevationLater - current) / SOLAR_TREND_MINUTES;
  // Only the sign matters: real polar sunsets can descend extremely slowly.
  const solarElevationTrend = !Number.isFinite(solarTrendDegreesPerMinute) ? "invalid"
    : solarTrendDegreesPerMinute < 0 ? "descending" : solarTrendDegreesPerMinute > 0 ? "ascending" : "stationary";
  return { solarElevationLater, solarTrendDegreesPerMinute, solarElevationTrend, isSunSetting: solarElevationTrend === "descending" };
}

export function getSunsetPhaseScore(elevation: number): number {
  const points: Array<[number, number]> = [[-7, 0], [-6, 10], [-5, 28], [-4.5, 45], [-4, 65], [-3, 88], [-2, 100], [-1, 100], [0, 98], [1, 90], [1.5, 75], [2.5, 15], [3, 5]];
  if (!Number.isFinite(elevation) || elevation < points[0][0] || elevation > points.at(-1)![0]) return 0;
  const upperIndex = points.findIndex(([value]) => elevation <= value);
  if (upperIndex === 0) return points[0][1];
  const [lowerElevation, lowerScore] = points[upperIndex - 1];
  const [upperElevation, upperScore] = points[upperIndex];
  const progress = (elevation - lowerElevation) / (upperElevation - lowerElevation);
  return Math.round((lowerScore + (upperScore - lowerScore) * progress) * 10) / 10;
}

export function getSunsetCandidates(cameras: Camera[], date: Date, stage: CandidateStage = "extended"): SunsetCandidate[] {
  return cameras
    .filter((camera) => camera.enabled && validCoordinates(camera.latitude, camera.longitude))
    .map((camera) => ({ camera, ...getSolarPosition(date, camera.latitude, camera.longitude) }))
    .filter(({ elevation }) => isElevationInWindow(elevation, stage))
    .map(({ camera, elevation, azimuth }) => ({ camera, solarElevation: elevation, solarAzimuth: azimuth, stage, ...getSolarTrend(date, camera.latitude, camera.longitude) }))
    .filter((candidate) => candidate.isSunSetting);
}
