import { describe, expect, it } from "vitest";
import { getSolarAzimuth, getSolarElevation, getSunsetCandidates, getSunsetPhaseScore, isSunsetElevation, normalizeDegrees } from "../lib/solar";
import type { Camera } from "../types/camera";

const camera = (id: string, latitude: number, longitude: number): Camera => ({ id, name: id, latitude, longitude, source: "mock", enabled: true, qualityWeight: 1 });

describe("sunset filtering", () => {
  it("uses the extended -6 through +2.5 degree boundary", () => {
    expect(isSunsetElevation(2.51)).toBe(false);
    expect(isSunsetElevation(2.5)).toBe(true);
    expect(isSunsetElevation(-2)).toBe(true);
    expect(isSunsetElevation(-6)).toBe(true);
    expect(isSunsetElevation(-7)).toBe(false);
  });

  it("places Europe near sunset while the opposite side is not", () => {
    const date = new Date("2026-03-20T17:00:00Z");
    const berlinElevation = getSolarElevation(date, 52.52, 13.405);
    const oppositeElevation = getSolarElevation(date, -52.52, -166.595);
    expect(berlinElevation).toBeGreaterThanOrEqual(-6);
    expect(berlinElevation).toBeLessThanOrEqual(2.5);
    expect(isSunsetElevation(oppositeElevation)).toBe(true);
    expect(getSunsetCandidates([camera("berlin", 52.52, 13.405), camera("opposite", -52.52, -166.595)], date).map((item) => item.camera.id)).toEqual(["berlin"]);
  });

  it("scores useful phases higher than deep afterglow", () => {
    expect(getSunsetPhaseScore(-1)).toBe(100);
    expect(getSunsetPhaseScore(-4)).toBe(65);
    expect(getSunsetPhaseScore(-6)).toBe(10);
    expect(getSunsetPhaseScore(-7)).toBe(0);
  });

  it("normalizes SunCalc azimuth to north-clockwise degrees", () => {
    expect(normalizeDegrees(-10)).toBe(350);
    const azimuth = getSolarAzimuth(new Date("2026-03-20T17:00:00Z"), 52.52, 13.405);
    expect(azimuth).toBeGreaterThan(240);
    expect(azimuth).toBeLessThan(300);
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
