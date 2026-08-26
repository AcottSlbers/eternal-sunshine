import { describe, expect, it } from "vitest";
import { getLongitudeBucket, scoreCameraCandidate, selectDistributedPool } from "../lib/camera-discovery";
import type { Camera } from "../types/camera";

const candidate = (id: string, longitude: number, latitude: number, score: number): Camera => ({ id, name: `Scenic beach ${id}`, latitude, longitude, source: "windy", enabled: true, qualityWeight: 1, lastKnownImageUrl: "https://example.test/a.jpg", discovery: { longitudeBucket: getLongitudeBucket(longitude), discoveredAt: "2026-01-01T00:00:00Z", candidateScore: { total: score, active: 25, currentImage: 20, freshness: 0, scenicCategory: 20, popularity: 0, resolution: 0, unsuitablePenalty: 0 } } });

describe("camera discovery", () => {
  it("maps the globe to 24 longitude buckets", () => {
    expect(getLongitudeBucket(-180)).toBe(0);
    expect(getLongitudeBucket(0)).toBe(12);
    expect(getLongitudeBucket(180)).toBe(23);
  });

  it("rewards scenic active cameras and penalizes unsuitable ones", () => {
    const scenic = candidate("scenic", 0, 0, 0);
    const traffic = { ...scenic, id: "traffic", name: "Indoor traffic parking" };
    expect(scoreCameraCandidate(scenic).total).toBeGreaterThan(scoreCameraCandidate(traffic).total);
  });

  it("supports a diverse, configurable selection within a bucket", () => {
    const pool = selectDistributedPool([candidate("a", 1, -60, 50), candidate("b", 2, -10, 40), candidate("c", 3, 10, 30), candidate("d", 4, 60, 20), candidate("e", 5, 70, 100)], 4);
    expect(pool).toHaveLength(4);
    expect(new Set(pool.map((camera) => Math.sign(camera.latitude))).size).toBeGreaterThan(1);
  });
});
