import { describe, expect, it } from "vitest";
import { getAngularDifference, getCameraDirection, getSunAlignmentScore, inferViewAzimuth } from "../lib/camera-direction";
import type { Camera } from "../types/camera";

const base: Camera = { id: "1", name: "Unknown view", latitude: 0, longitude: 0, source: "mock", enabled: true, qualityWeight: 1 };

describe("camera direction", () => {
  it("rates a 68-degree difference as weak and stays monotonic across the curve", () => {
    const alignment = getSunAlignmentScore(0, 292);
    expect(alignment.difference).toBe(68);
    expect(alignment.score).toBeGreaterThan(20);
    expect(alignment.score).toBeLessThan(35);
    const scores = Array.from({ length: 181 }, (_, angle) => getSunAlignmentScore(0, angle).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
  it("handles the 0/360 degree boundary", () => {
    expect(getAngularDifference(350, 10)).toBe(20);
  });

  it("extracts only explicit direction labels", () => {
    expect(inferViewAzimuth("Beach › South-west: Praia")).toBe(225);
    expect(inferViewAzimuth("Harbor › West")).toBe(270);
    expect(inferViewAzimuth("South Georgia island")).toBeUndefined();
  });

  it("strongly favors a west-facing camera for a western sun", () => {
    expect(getSunAlignmentScore(270, 275).score).toBeGreaterThan(95);
    expect(getSunAlignmentScore(90, 270).score).toBe(0);
  });

  it("uses a neutral score and unknown confidence without direction metadata", () => {
    expect(getCameraDirection(base)).toEqual({ confidence: "unknown" });
    expect(getSunAlignmentScore(undefined, 270)).toEqual({ score: 65 });
  });
});
