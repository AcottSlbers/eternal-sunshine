import { COVERAGE_SLOT_MINUTES, IDEAL_STRICT_COVERAGE, MIN_CAMERA_QUALITY, TARGET_STRICT_COVERAGE, TARGET_TOTAL_COVERAGE } from "@/lib/config";
import { getCameraDirection } from "@/lib/camera-direction";
import { getSolarElevation, isElevationInWindow } from "@/lib/solar";
import type { Camera } from "@/types/camera";

export const REPRESENTATIVE_DATES = [
  ["Jan", "2026-01-15"], ["Feb", "2026-02-15"], ["Mar equinox", "2026-03-20"],
  ["Apr", "2026-04-15"], ["May", "2026-05-15"], ["Jun solstice", "2026-06-21"],
  ["Jul", "2026-07-15"], ["Aug", "2026-08-15"], ["Sep equinox", "2026-09-22"],
  ["Oct", "2026-10-15"], ["Nov", "2026-11-15"], ["Dec solstice", "2026-12-21"],
] as const;

export interface CoverageSlot { index: number; timestamp: string; dateLabel: string; utcTime: string }
export interface CameraCoverage { strictSlots: number[]; extendedSlots: number[] }
export interface CoverageMatrix { slots: CoverageSlot[]; byCamera: Map<string, CameraCoverage> }
export interface CoverageStatistics {
  cameraCount: number; averageStrict: number; medianStrict: number; minimumStrict: number;
  percentile5Strict: number; maximumStrict: number; slotsBelowStrictTarget: number;
  averageTotal: number; minimumTotal: number; slotsBelowTotalTarget: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function buildCoverageMatrix(cameras: Camera[], slotMinutes = COVERAGE_SLOT_MINUTES): CoverageMatrix {
  const slotsPerDay = 24 * 60 / slotMinutes;
  const slots: CoverageSlot[] = REPRESENTATIVE_DATES.flatMap(([label, date], dateIndex) => Array.from({ length: slotsPerDay }, (_, slotIndex) => {
    const minutes = slotIndex * slotMinutes;
    const timestamp = new Date(`${date}T00:00:00Z`).getTime() + minutes * 60_000;
    return { index: dateIndex * slotsPerDay + slotIndex, timestamp: new Date(timestamp).toISOString(), dateLabel: label, utcTime: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` };
  }));
  const byCamera = new Map<string, CameraCoverage>();
  for (const camera of cameras) {
    const strictSlots: number[] = []; const extendedSlots: number[] = [];
    for (let dateIndex = 0; dateIndex < REPRESENTATIVE_DATES.length; dateIndex += 1) {
      const date = REPRESENTATIVE_DATES[dateIndex][1];
      const start = new Date(`${date}T00:00:00Z`).getTime();
      const elevations = Array.from({ length: slotsPerDay + 1 }, (_, slotIndex) => getSolarElevation(new Date(start + slotIndex * slotMinutes * 60_000), camera.latitude, camera.longitude));
      for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex += 1) {
        const elevation = elevations[slotIndex];
        if (!Number.isFinite(elevation) || elevations[slotIndex + 1] >= elevation) continue;
        const globalIndex = dateIndex * slotsPerDay + slotIndex;
        if (isElevationInWindow(elevation, "extended")) extendedSlots.push(globalIndex);
        if (isElevationInWindow(elevation, "strict")) strictSlots.push(globalIndex);
      }
    }
    byCamera.set(camera.id, { strictSlots, extendedSlots });
  }
  return { slots, byCamera };
}

export function getCoverageCounts(cameraIds: Iterable<string>, matrix: CoverageMatrix): { strict: Uint16Array; total: Uint16Array } {
  const strict = new Uint16Array(matrix.slots.length); const total = new Uint16Array(matrix.slots.length);
  for (const id of cameraIds) {
    const coverage = matrix.byCamera.get(id); if (!coverage) continue;
    coverage.strictSlots.forEach((slot) => { strict[slot] += 1; });
    coverage.extendedSlots.forEach((slot) => { total[slot] += 1; });
  }
  return { strict, total };
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

export function getCoverageStatistics(cameraIds: Iterable<string>, matrix: CoverageMatrix): CoverageStatistics {
  const ids = [...cameraIds]; const counts = getCoverageCounts(ids, matrix);
  const strict = [...counts.strict]; const total = [...counts.total]; const sorted = [...strict].sort((a, b) => a - b);
  return {
    cameraCount: ids.length, averageStrict: round(strict.reduce((sum, value) => sum + value, 0) / strict.length),
    medianStrict: percentile(sorted, 0.5), minimumStrict: sorted[0] ?? 0, percentile5Strict: percentile(sorted, 0.05),
    maximumStrict: sorted.at(-1) ?? 0, slotsBelowStrictTarget: strict.filter((value) => value < TARGET_STRICT_COVERAGE).length,
    averageTotal: round(total.reduce((sum, value) => sum + value, 0) / total.length), minimumTotal: Math.min(...total),
    slotsBelowTotalTarget: total.filter((value) => value < TARGET_TOTAL_COVERAGE).length,
  };
}

export function calculateCoverageContribution(coverage: CameraCoverage, strictCounts: Uint16Array, totalCounts: Uint16Array): number {
  let benefit = 0;
  for (const slot of coverage.strictSlots) {
    const count = strictCounts[slot];
    benefit += count < TARGET_STRICT_COVERAGE ? 4 + (TARGET_STRICT_COVERAGE - count) ** 2 / TARGET_STRICT_COVERAGE : count < IDEAL_STRICT_COVERAGE ? 0.8 : 0.05 / (count - IDEAL_STRICT_COVERAGE + 1);
  }
  for (const slot of coverage.extendedSlots) {
    const count = totalCounts[slot];
    benefit += count < TARGET_TOTAL_COVERAGE ? 0.5 + (TARGET_TOTAL_COVERAGE - count) / TARGET_TOTAL_COVERAGE : 0.02 / (count - TARGET_TOTAL_COVERAGE + 1);
  }
  return round(benefit);
}

function distanceKm(first: Camera, second: Camera): number {
  const radians = Math.PI / 180; const deltaLat = (second.latitude - first.latitude) * radians; const deltaLon = (second.longitude - first.longitude) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function optimizeRegistry(cameras: Camera[], matrix: CoverageMatrix, targetCount: number): Camera[] {
  const eligible = cameras.filter((camera) => camera.enabled && !camera.permanentlyRejected && (camera.review?.quality.score ?? 0) >= MIN_CAMERA_QUALITY);
  const remaining = new Map(eligible.map((camera) => [camera.id, camera]));
  const selected: Camera[] = []; const counts = getCoverageCounts([], matrix);
  const countryCounts = new Map<string, number>(); const regionCounts = new Map<string, number>();
  const minimumDistances = new Map(eligible.map((camera) => [camera.id, Number.POSITIVE_INFINITY]));
  while (selected.length < targetCount && remaining.size > 0) {
    const ranked = [...remaining.values()].map((camera) => {
      const coverage = matrix.byCamera.get(camera.id) ?? { strictSlots: [], extendedSlots: [] };
      const contribution = calculateCoverageContribution(coverage, counts.strict, counts.total);
      const quality = camera.review?.quality.score ?? 0;
      const countryBonus = 6 / (1 + (countryCounts.get(camera.country ?? "unknown") ?? 0));
      const regionBonus = 3 / (1 + (regionCounts.get(`${camera.country}/${camera.region}`) ?? 0));
      const distanceBonus = Math.min(6, (minimumDistances.get(camera.id) ?? 0) / 1000);
      const directionBonus = getCameraDirection(camera).viewAzimuth === undefined ? 0 : 2;
      return { camera, contribution, total: contribution + quality / 100 * 5 + countryBonus + regionBonus + distanceBonus + directionBonus };
    }).sort((a, b) => b.total - a.total || b.contribution - a.contribution || (b.camera.review?.quality.score ?? 0) - (a.camera.review?.quality.score ?? 0) || a.camera.id.localeCompare(b.camera.id));
    const best = ranked[0]; const coverage = matrix.byCamera.get(best.camera.id)!;
    coverage.strictSlots.forEach((slot) => { counts.strict[slot] += 1; }); coverage.extendedSlots.forEach((slot) => { counts.total[slot] += 1; });
    const selectedCamera: Camera = { ...best.camera, review: { ...best.camera.review!, coverageContributionScore: best.contribution, selectionRank: selected.length + 1 } };
    selected.push(selectedCamera); remaining.delete(best.camera.id);
    countryCounts.set(best.camera.country ?? "unknown", (countryCounts.get(best.camera.country ?? "unknown") ?? 0) + 1);
    const regionKey = `${best.camera.country}/${best.camera.region}`; regionCounts.set(regionKey, (regionCounts.get(regionKey) ?? 0) + 1);
    remaining.forEach((camera) => minimumDistances.set(camera.id, Math.min(minimumDistances.get(camera.id)!, distanceKm(best.camera, camera))));
  }
  return selected;
}
