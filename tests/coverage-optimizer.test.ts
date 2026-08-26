import { describe, expect, it } from "vitest";
import { buildCoverageMatrix, calculateCoverageContribution, getCoverageStatistics, optimizeRegistry, type CameraCoverage, type CoverageMatrix } from "../lib/coverage-optimizer";
import type { Camera } from "../types/camera";

function reviewedCamera(id: string, quality: number, latitude = 0, longitude = 0, extras: Partial<Camera> = {}): Camera {
  return {
    id, name: id, latitude, longitude, country: `country-${id}`, region: `region-${id}`, source: "windy", enabled: true, qualityWeight: 1, ...extras,
    review: { quality: { score: quality, metadataScore: quality, scenicScore: 0, freshnessReliability: 0, directionScore: 0, resolutionScore: 0, categoryPenalty: 0, liveCapabilityBonus: 0, analyzedAt: "2026-01-01T00:00:00Z" }, coverage: { strictSlotCount: 0, extendedSlotCount: 0, representativeDates: 12 } },
  };
}

function syntheticMatrix(coverage: Record<string, CameraCoverage>, slotCount = 2): CoverageMatrix {
  return { slots: Array.from({ length: slotCount }, (_, index) => ({ index, timestamp: new Date(index * 900_000).toISOString(), dateLabel: "test", utcTime: `00:${String(index * 15).padStart(2, "0")}` })), byCamera: new Map(Object.entries(coverage)) };
}

describe("coverage optimizer", () => {
  it("builds different seasonal coverage for different latitudes at one longitude", () => {
    const equator = reviewedCamera("equator", 80, 0, 10); const arctic = reviewedCamera("arctic", 80, 70, 10);
    const matrix = buildCoverageMatrix([equator, arctic]);
    const equatorCoverage = matrix.byCamera.get("equator")!; const arcticCoverage = matrix.byCamera.get("arctic")!;
    expect(equatorCoverage.strictSlots.length).toBeGreaterThan(0);
    expect(arcticCoverage.strictSlots).not.toEqual(equatorCoverage.strictSlots);
    const arcticMonths = new Set(arcticCoverage.strictSlots.map((slot) => Math.floor(slot / 96)));
    expect(arcticMonths.size).toBeLessThanOrEqual(12);
  });

  it("values a camera that closes a gap over a redundant camera", () => {
    const openCounts = new Uint16Array([0, 0]); const coveredCounts = new Uint16Array([8, 0]);
    const slotZero = { strictSlots: [0], extendedSlots: [0] }; const slotOne = { strictSlots: [1], extendedSlots: [1] };
    expect(calculateCoverageContribution(slotOne, coveredCounts, coveredCounts)).toBeGreaterThan(calculateCoverageContribution(slotZero, coveredCounts, coveredCounts));
    expect(calculateCoverageContribution(slotZero, openCounts, openCounts)).toBeGreaterThan(0);
  });

  it("balances quality and coverage while enforcing quality and rejection rules", () => {
    const cameras = [reviewedCamera("high", 95), reviewedCamera("redundant", 90), reviewedCamera("gap", 60), reviewedCamera("low", 39), reviewedCamera("rejected", 100, 0, 0, { permanentlyRejected: true })];
    const matrix = syntheticMatrix({ high: { strictSlots: [0], extendedSlots: [0] }, redundant: { strictSlots: [0], extendedSlots: [0] }, gap: { strictSlots: [1], extendedSlots: [1] }, low: { strictSlots: [1], extendedSlots: [1] }, rejected: { strictSlots: [1], extendedSlots: [1] } });
    const selected = optimizeRegistry(cameras, matrix, 3).map((camera) => camera.id);
    expect(selected.slice(0, 2)).toEqual(["high", "gap"]);
    expect(selected).not.toContain("low");
    expect(selected).not.toContain("rejected");
  });

  it("produces deterministic prefixes for 192, 250, 300, and 400 cameras", () => {
    const cameras = Array.from({ length: 400 }, (_, index) => reviewedCamera(String(index).padStart(3, "0"), 60 + index % 30));
    const matrix = syntheticMatrix(Object.fromEntries(cameras.map((camera, index) => [camera.id, { strictSlots: [index % 2], extendedSlots: [index % 2] }])));
    const first = optimizeRegistry(cameras, matrix, 400); const second = optimizeRegistry(cameras, matrix, 400);
    expect(first.map((camera) => camera.id)).toEqual(second.map((camera) => camera.id));
    for (const size of [192, 250, 300, 400]) expect(getCoverageStatistics(first.slice(0, size).map((camera) => camera.id), matrix).cameraCount).toBe(size);
  });
});
