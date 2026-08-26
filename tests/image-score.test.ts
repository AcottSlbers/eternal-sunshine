import { describe, expect, it } from "vitest";
import { analyzeSunsetImage } from "../lib/image-score";
import { sunsetScenes } from "./fixtures/sunset-scenes";

async function score(scene: () => Promise<Buffer>, phase = 95) {
  return analyzeSunsetImage(await scene(), phase);
}

describe("visual sunset scoring calibration", () => {
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
