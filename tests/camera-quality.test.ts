import { describe, expect, it } from "vitest";
import { calculateCameraQuality } from "../lib/camera-quality";
import type { Camera } from "../types/camera";

const camera = (categories: string[], extras: Partial<Camera> = {}): Camera => ({ id: "1", name: "Camera", latitude: 0, longitude: 0, source: "windy", enabled: true, qualityWeight: 1, categories, discovery: { longitudeBucket: 12, discoveredAt: "2026-08-26T12:00:00Z", candidateScore: { total: 0, active: 0, currentImage: 0, freshness: 0, scenicCategory: 0, popularity: 0, resolution: 0, unsuitablePenalty: 0 } }, lastKnownImageTimestamp: "2026-08-26T11:55:00Z", ...extras });

describe("camera quality", () => {
  it("rewards scenic metadata over traffic and building categories", () => {
    const date = new Date("2026-08-26T12:00:00Z");
    expect(calculateCameraQuality(camera(["coast", "landscape"]), date).score).toBeGreaterThan(calculateCameraQuality(camera(["traffic", "building"]), date).score);
  });

  it("honors a manual quality override", () => {
    expect(calculateCameraQuality(camera(["traffic"], { manualQualityOverride: 88 }), new Date()).score).toBe(88);
  });
});
