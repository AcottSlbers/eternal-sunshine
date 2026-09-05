import { describe, expect, it } from "vitest";
import { classifySunsetVisibility } from "../lib/sunset-visibility";
import { analyzeSunsetImage } from "../lib/image-score";
import { analyzeImageBuffer } from "../lib/image-viability";
import { sunsetScenes } from "./fixtures/sunset-scenes";

const viable = { viable: true, status: "viable" as const, brightness: 50, saturation: 50, darkPixelRatio: 0, blueGrayRatio: 0 };
const input = (evidence: number, score: number) => ({ sunsetEvidenceScore: evidence, sunsetScore: score, visualScoreStatus: "analyzed" as const, imageViability: viable, isSunSetting: true });

describe("visible sunset gate", () => {
  it("rejects the reported low-evidence case regardless of astronomical opportunity", () => {
    expect(classifySunsetVisibility(input(9.2, 6.3))).toEqual({ visibility: "rejected-evidence", reason: "Rejected: insufficient sunset evidence" });
  });

  it("rejects a real analyzed snowy blue fixture even at peak sunset phase", async () => {
    const buffer = await sunsetScenes.snowyBlueScene();
    const visual = await analyzeSunsetImage(buffer, 100);
    const imageViability = await analyzeImageBuffer(buffer);
    expect(classifySunsetVisibility({ ...visual, visualScoreStatus: visual.status, imageViability, isSunSetting: true }).visibility).toBe("rejected-evidence");
  });

  it("features an analyzed orange/pink sunset", async () => {
    const buffer = await sunsetScenes.dramaticSunset();
    const visual = await analyzeSunsetImage(buffer, 95);
    expect(classifySunsetVisibility({ ...visual, visualScoreStatus: visual.status, imageViability: await analyzeImageBuffer(buffer), isSunSetting: true }).visibility).toBe("featured");
  });

  it("separates marginal visible twilight from featured sunsets with inclusive boundaries", () => {
    expect(classifySunsetVisibility(input(20, 20)).visibility).toBe("visible");
    expect(classifySunsetVisibility(input(29.9, 40)).visibility).toBe("visible");
    expect(classifySunsetVisibility(input(40, 29.9)).visibility).toBe("visible");
    expect(classifySunsetVisibility(input(30, 30)).visibility).toBe("featured");
    expect(classifySunsetVisibility(input(90, 19.9)).visibility).toBe("rejected-evidence");
    expect(classifySunsetVisibility(input(19.9, 90)).visibility).toBe("rejected-evidence");
  });

  it("fails closed for unavailable, invalid, unviable, and non-setting results", () => {
    expect(classifySunsetVisibility({ ...input(90, 90), visualScoreStatus: "unavailable" }).visibility).toBe("rejected-other");
    expect(classifySunsetVisibility({ ...input(90, 90), imageViability: { ...viable, status: "unavailable" } }).visibility).toBe("rejected-other");
    expect(classifySunsetVisibility({ ...input(90, 90), isSunSetting: false }).visibility).toBe("rejected-other");
    expect(classifySunsetVisibility(input(NaN, 90)).visibility).toBe("rejected-other");
  });
});
