import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeSunsetImage } from "../lib/image-score";
import { isCredibleSunset } from "../lib/sunset-visibility";
import { primaryEvidencePath, type SolarImageContext } from "../lib/sunset-evidence";
import { sunsetScenes } from "./fixtures/sunset-scenes";

const context: SolarImageContext = { isSunSetting: true, solarElevation: -.5, solarAzimuth: 279 };
function decision(visual: Awaited<ReturnType<typeof analyzeSunsetImage>>) {
  return isCredibleSunset({ ...visual, sunsetMetrics: visual.metrics, visualScoreStatus: visual.status, isSunSetting: true,
    imageViability: { viable: true, status: "viable", brightness: 50, saturation: 30, darkPixelRatio: 0, blueGrayRatio: 0 } });
}

describe("independent visual Evidence paths", () => {
  it.each([
    ["pastelSunset", "pastelEvidencePath"],
    ["hazyLuminousSunset", "luminousHorizonEvidencePath"],
    ["softLavenderAfterglow", "twilightEvidencePath"],
  ] as const)("admits %s through an explainable specialized path", async (scene, path) => {
    const result = await analyzeSunsetImage(await sunsetScenes[scene](), 95, context);
    expect(result.metrics[path]).toBeGreaterThan(40);
    expect(decision(result).isCredibleSunset).toBe(true);
    expect(decision(result).credibleSunsetReason).toContain("Credible via");
    expect(result.sunsetScore).toBeGreaterThanOrEqual(20);
    const paths = [result.metrics.chromaticEvidencePath, result.metrics.pastelEvidencePath,
      result.metrics.luminousHorizonEvidencePath, result.metrics.twilightEvidencePath, result.metrics.solarGlowEvidencePath];
    expect(result.sunsetEvidenceScore).toBe(Math.max(...paths));
  });

  it.each(["selfossLike", "snowyBlueScene", "grayHarbor", "overcastRoad", "ordinaryColorfulLandscape",
    "night", "monochromePlaceholder", "tinyOrangeObject", "artificialStreetlight", "paleForeground"] as const)("still rejects %s", async scene => {
    const result = await analyzeSunsetImage(await sunsetScenes[scene](), 95, context);
    expect(result.sunsetScore).toBeLessThanOrEqual(6);
    expect(decision(result).isCredibleSunset).toBe(false);
  });

  it("requires a localized solar glow in the calibrated azimuth, not a generic bright band", async () => {
    const buffer = await sunsetScenes.intenseHorizonSunset();
    const calibrated = { ...context, cameraAzimuth: 270, horizontalFieldOfView: 60, solarElevation: 0 };
    const aligned = await analyzeSunsetImage(buffer, 95, calibrated);
    const away = await analyzeSunsetImage(buffer, 95, { ...calibrated, solarAzimuth: 190 });
    const unknown = await analyzeSunsetImage(buffer, 95, context);
    const streetlight = await analyzeSunsetImage(await sunsetScenes.artificialStreetlight(), 95, calibrated);
    const haze = await analyzeSunsetImage(await sunsetScenes.hazyLuminousSunset(), 95, calibrated);
    expect(aligned.metrics.solarGlowEvidencePath).toBeGreaterThan(50);
    for (const result of [away, unknown, streetlight, haze]) expect(result.metrics.solarGlowEvidencePath).toBe(0);
  });

  it.each([{ ...context, isSunSetting: false }, { ...context, solarElevation: 20 }])("never admits invalid sunset astronomy", async astronomy => {
    const result = await analyzeSunsetImage(await sunsetScenes.pastelSunset(), 95, astronomy);
    expect(result.sunsetEvidenceScore).toBe(0);
    expect(result.sunsetScore).toBe(0);
    expect(decision(result).isCredibleSunset).toBe(false);
  });
});

describe("captured real false negatives", () => {
  it("admits the user-preferred Parentis glow through the strict alternative without inflating Evidence", async () => {
    const result = await analyzeSunsetImage(await readFile(new URL("./fixtures/real/parentis-2026-09-11.jpg", import.meta.url)), 65.3,
      { ...context, solarElevation: 1.66 });
    expect(result.sunsetEvidenceScore).toBeCloseTo(18.5, 1);
    expect(result.sunsetBeautyScore).toBeGreaterThan(30);
    expect(result.sunsetScore).toBeGreaterThan(30);
    expect(decision(result).isCredibleSunset).toBe(true);
    expect(decision(result).credibleSunsetReason).toContain("high-confidence luminous");
    for (const metrics of [
      { ...result.metrics, evidenceForegroundLeakageRatio: .8 },
      { ...result.metrics, skyConfidence: 50 },
      { ...result.metrics, evidenceSkyGeometry: 40 },
      { ...result.metrics, evidenceHorizonWidth: 20 },
      { ...result.metrics, validatedHorizonLuminanceScore: 40 },
    ]) expect(decision({ ...result, metrics }).isCredibleSunset).toBe(false);
    expect(decision({ ...result, sunsetBeautyScore: 20 }).isCredibleSunset).toBe(false);
  });
  it("rejects the real Berlin city lights that formerly passed the chromatic path", async () => {
    const result = await analyzeSunsetImage(await readFile(new URL("./fixtures/real/berlin-artificial-lights-2026-09-11.jpg", import.meta.url)), 19.6,
      { ...context, solarElevation: -5.47 });
    expect(result.metrics.chromaticColorEvidence).toBeGreaterThan(20);
    expect(result.metrics.naturalSkySupport).toBeLessThan(5);
    expect(result.sunsetScore).toBeLessThan(1);
    expect(decision(result).isCredibleSunset).toBe(false);
  });
  it("recognizes the original North Cape sunset without a camera ID exception", async () => {
    const result = await analyzeSunsetImage(await readFile(new URL("./fixtures/real/north-cape-2026-09-11.jpg", import.meta.url)), 96.6,
      { ...context, solarElevation: .176, solarAzimuth: 283.66 });
    expect(result.metrics.chromaticEvidencePath).toBe(0);
    expect(primaryEvidencePath(result.metrics)).toBe("luminous-horizon");
    expect(result.sunsetScore).toBeGreaterThan(25);
    expect(decision(result).isCredibleSunset).toBe(true);
  });
  it("preserves Marathia's successful Beauty calibration", async () => {
    const result = await analyzeSunsetImage(await readFile(new URL("./fixtures/real/marathia-2026-09-11.jpg", import.meta.url)), 68.9, context);
    expect(result.metrics.chromaticEvidencePath).toBeCloseTo(24.3, 1);
    expect(result.sunsetBeautyScore).toBeCloseTo(50.7, 1);
    expect(result.sunsetScore).toBeGreaterThanOrEqual(46);
    expect(decision(result).isCredibleSunset).toBe(true);
  });
  it("admits Corneliano as a subtle sunset over buildings", async () => {
    const result = await analyzeSunsetImage(await readFile(new URL("./fixtures/real/corneliano-2026-09-11.jpg", import.meta.url)), 100, context);
    expect(result.metrics.chromaticEvidencePath).toBe(0);
    expect(primaryEvidencePath(result.metrics)).toBe("pastel");
    expect(result.sunsetScore).toBeGreaterThanOrEqual(20);
    expect(result.sunsetScore).toBeLessThan(40);
    expect(decision(result).isCredibleSunset).toBe(true);
  });
});
