import { describe, expect, it } from "vitest";
import { analyzeSunsetImage } from "../lib/image-score";
import { sunsetScenes } from "./fixtures/sunset-scenes";

async function score(scene: () => Promise<Buffer>, phase = 95) {
  return analyzeSunsetImage(await scene(), phase);
}

describe("visual sunset scoring calibration", () => {
  it("separates a bright horizon sunset, subtle twilight and Selfoss-like terrain", async () => {
    const clear = await score(sunsetScenes.intenseHorizonSunset);
    const subtle = await score(sunsetScenes.subtleHorizonTwilight);
    const landscape = await score(sunsetScenes.selfossLike);
    expect(clear.sunsetScore - subtle.sunsetScore).toBeGreaterThan(8);
    expect(subtle.sunsetScore - landscape.sunsetScore).toBeGreaterThan(20);
    expect(subtle.sunsetScore).toBeGreaterThanOrEqual(20);
    expect(landscape.sunsetEvidenceScore).toBeLessThan(20);
    expect(landscape.metrics.foregroundSunsetLeakageRatio).toBeGreaterThan(.8);
    expect(landscape.metrics.horizonGlowScore).toBeLessThan(15);
    expect(clear.metrics.horizonGlowScore).toBeGreaterThan(landscape.metrics.horizonGlowScore + 20);
    expect(landscape.metrics.estimatedHorizonY).toBeLessThan(.65);
    expect(landscape.metrics.horizonConfidence).toBeGreaterThan(25);
  });

  it("requires connected sky color rather than isolated orange pixels", async () => {
    const isolated = await score(sunsetScenes.isolatedOrangePixels);
    expect(isolated.metrics.sunsetColorGeometryScore).toBeLessThan(15);
    expect(isolated.sunsetScore).toBeLessThan(10);
  });
  it("does not mistake a high-horizon road landscape for warm sky", async () => {
    const landscape = await score(sunsetScenes.highHorizonTerrain);
    expect(landscape.sunsetEvidenceScore).toBeLessThan(20);
    expect(landscape.metrics.foregroundSunsetLeakageRatio).toBeGreaterThan(.8);
  });
  it("retains a genuine bright horizon above warm roofs", async () => {
    const sunset = await score(sunsetScenes.sunsetAboveWarmRoofs);
    expect(sunset.metrics.foregroundSunsetLeakageRatio).toBeGreaterThan(.6);
    expect(sunset.metrics.horizonGlowScore).toBeGreaterThan(40);
    expect(sunset.sunsetScore).toBeGreaterThan(30);
  });

  it("falls back transparently for a featureless image", async () => {
    const placeholder = await score(sunsetScenes.monochromePlaceholder);
    expect(placeholder.metrics.horizonConfidence).toBeLessThan(25);
    expect(placeholder.metrics.estimatedHorizonY).toBeCloseTo(.7, 1);
    expect(placeholder.sunsetScore).toBe(0);
  });
  it("keeps explicit non-sunset examples clearly low", async () => {
    const negatives = await Promise.all([
      score(sunsetScenes.grayCloudyLandscape), score(sunsetScenes.snowyBlueScene),
      score(sunsetScenes.overcastRoad), score(sunsetScenes.grayHarbor), score(sunsetScenes.monochromePlaceholder),
    ]);
    for (const result of negatives) {
      expect(result.sunsetEvidenceScore).toBeLessThan(35);
      expect(result.sunsetScore).toBeLessThan(35);
    }
  });

  it("produces meaningful ordering and spacing across calibrated scenes", async () => {
    const dramatic = await score(sunsetScenes.dramaticSunset);
    const twilight = await score(sunsetScenes.twilightAfterglow);
    const weak = await score(sunsetScenes.weakSunsetSignal);
    const ordinary = await score(sunsetScenes.ordinaryColorfulLandscape);
    const gray = await score(sunsetScenes.grayCloudyLandscape);
    const night = await score(sunsetScenes.night);
    const placeholder = await score(sunsetScenes.monochromePlaceholder);

    expect(dramatic.sunsetScore).toBeGreaterThan(twilight.sunsetScore);
    expect(twilight.sunsetScore).toBeGreaterThan(weak.sunsetScore);
    expect(weak.sunsetScore).toBeGreaterThan(ordinary.sunsetScore);
    expect(ordinary.sunsetScore).toBeGreaterThan(gray.sunsetScore);
    expect(gray.sunsetScore).toBeGreaterThanOrEqual(Math.max(night.sunsetScore, placeholder.sunsetScore));
    expect(dramatic.sunsetScore - gray.sunsetScore).toBeGreaterThan(45);
    expect(twilight.sunsetScore - weak.sunsetScore).toBeGreaterThan(8);
  });

  it("treats contrast and foreground color only as enhancements, not evidence", async () => {
    const road = await score(sunsetScenes.overcastRoad);
    const ordinary = await score(sunsetScenes.ordinaryColorfulLandscape);
    expect(road.metrics.luminanceContrast).toBeGreaterThan(0);
    expect(road.sunsetScore).toBeLessThan(20);
    expect(ordinary.metrics.foregroundSunsetColorShare).toBeGreaterThan(0);
    expect(ordinary.sunsetEvidenceScore).toBeLessThan(30);
  });

  it("uses astronomical phase as plausibility without creating evidence", async () => {
    const likely = await score(sunsetScenes.weakSunsetSignal, 100);
    const unlikely = await score(sunsetScenes.weakSunsetSignal, 5);
    const gray = await score(sunsetScenes.grayCloudyLandscape, 100);
    expect(likely.sunsetEvidenceScore).toBeGreaterThan(unlikely.sunsetEvidenceScore);
    expect(gray.sunsetEvidenceScore).toBeLessThan(15);
  });
});
