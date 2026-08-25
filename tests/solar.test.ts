import { describe, expect, it } from "vitest";
import { getSolarElevation, getSunsetCandidates, isSunsetElevation } from "../lib/solar";
import type { Camera } from "../types/camera";

const camera = (id: string, latitude: number, longitude: number): Camera => ({ id, name: id, latitude, longitude, source: "mock", enabled: true, qualityWeight: 1 });

describe("sunset filtering", () => {
  it("accepts elevations from -7 through +3 degrees only", () => {
    expect(isSunsetElevation(3.01)).toBe(false);
    expect(isSunsetElevation(3)).toBe(true);
    expect(isSunsetElevation(-2)).toBe(true);
    expect(isSunsetElevation(-7)).toBe(true);
    expect(isSunsetElevation(-7.01)).toBe(false);
  });

  it("places Europe near sunset while the opposite side is not", () => {
    const date = new Date("2026-03-20T17:00:00Z");
    const berlinElevation = getSolarElevation(date, 52.52, 13.405);
    const oppositeElevation = getSolarElevation(date, -52.52, -166.595);
    expect(berlinElevation).toBeGreaterThanOrEqual(-7);
    expect(berlinElevation).toBeLessThanOrEqual(3);
    expect(isSunsetElevation(oppositeElevation)).toBe(true);
    expect(getSunsetCandidates([camera("berlin", 52.52, 13.405), camera("opposite", -52.52, -166.595)], date).map((item) => item.camera.id)).toEqual(["berlin"]);
  });

  it("rejects invalid cameras without affecting valid cameras", () => {
    const date = new Date("2026-03-20T17:00:00Z");
    const results = getSunsetCandidates([camera("valid", 52.52, 13.405), camera("invalid", 999, 0)], date);
    expect(results.map((result) => result.camera.id)).toEqual(["valid"]);
  });

  it("moves the sunset zone across longitudes over the day", () => {
    const cameras = [-180, -120, -60, 0, 60, 120].map((longitude) => camera(String(longitude), 0, longitude));
    const morning = getSunsetCandidates(cameras, new Date("2026-03-20T06:00:00Z"));
    const evening = getSunsetCandidates(cameras, new Date("2026-03-20T18:00:00Z"));
    expect(morning.map((item) => item.camera.id)).not.toEqual(evening.map((item) => item.camera.id));
    expect(morning.length).toBeGreaterThan(0);
    expect(evening.length).toBeGreaterThan(0);
  });
});
