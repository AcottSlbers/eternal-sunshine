import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeImageBuffer } from "../lib/image-viability";

describe("image viability", () => {
  it("rejects an overwhelmingly dark image", async () => {
    const buffer = await sharp({ create: { width: 128, height: 72, channels: 3, background: { r: 3, g: 3, b: 5 } } }).png().toBuffer();
    const result = await analyzeImageBuffer(buffer);
    expect(result.viable).toBe(false);
    expect(result.darkPixelRatio).toBeGreaterThan(0.88);
  });

  it("keeps a normal blue twilight image", async () => {
    const buffer = await sharp({ create: { width: 128, height: 72, channels: 3, background: { r: 55, g: 85, b: 145 } } }).png().toBuffer();
    const result = await analyzeImageBuffer(buffer);
    expect(result.viable).toBe(true);
    expect(result.blueGrayRatio).toBeGreaterThan(0.5);
  });
});
