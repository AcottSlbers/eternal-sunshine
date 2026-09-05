import { SUNSET_STRENGTH_LEVELS } from "@/lib/config";

export function getSunsetStrength(sunsetScore: number): string {
  return SUNSET_STRENGTH_LEVELS.find((level) => Number.isFinite(sunsetScore) && sunsetScore >= level.minimum)?.label ?? "not visible";
}
