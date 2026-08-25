import SunCalc from "suncalc";
import { SUNSET_WINDOW } from "@/lib/config";
import type { Camera } from "@/types/camera";
import type { SunsetCandidate } from "@/types/ranking";

const RADIANS_TO_DEGREES = 180 / Math.PI;

export function getSolarElevation(date: Date, latitude: number, longitude: number): number {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return Number.NaN;
  return SunCalc.getPosition(date, latitude, longitude).altitude * RADIANS_TO_DEGREES;
}

export function isSunsetElevation(elevation: number): boolean {
  return Number.isFinite(elevation) && elevation >= SUNSET_WINDOW.minimumElevation && elevation <= SUNSET_WINDOW.maximumElevation;
}

export function isSunDescending(date: Date, latitude: number, longitude: number): boolean {
  const current = getSolarElevation(date, latitude, longitude);
  const oneMinuteLater = getSolarElevation(new Date(date.getTime() + 60_000), latitude, longitude);
  return Number.isFinite(current) && Number.isFinite(oneMinuteLater) && oneMinuteLater < current;
}

export function getSunsetCandidates(cameras: Camera[], date: Date): SunsetCandidate[] {
  return cameras
    .filter((camera) => camera.enabled && Number.isFinite(camera.latitude) && Number.isFinite(camera.longitude) && camera.latitude >= -90 && camera.latitude <= 90 && camera.longitude >= -180 && camera.longitude <= 180)
    .map((camera) => ({ camera, solarElevation: getSolarElevation(date, camera.latitude, camera.longitude) }))
    .filter(({ camera, solarElevation }) => isSunsetElevation(solarElevation) && isSunDescending(date, camera.latitude, camera.longitude));
}
