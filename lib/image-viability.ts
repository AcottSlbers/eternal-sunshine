import sharp from "sharp";
import type { ImageViability } from "@/types/ranking";

export const UNAVAILABLE_IMAGE_VIABILITY: ImageViability = {
  brightness: 0, saturation: 0, darkPixelRatio: 0, blueGrayRatio: 0,
  viable: true, status: "unavailable", reason: "Image could not be checked; treated neutrally.",
};

export async function analyzeImageBuffer(buffer: Buffer): Promise<ImageViability> {
  const { data, info } = await sharp(buffer).resize(128, 72, { fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3 || info.width === 0 || info.height === 0) return { ...UNAVAILABLE_IMAGE_VIABILITY, viable: false, status: "rejected", reason: "Invalid image pixels." };
  const pixelCount = info.width * info.height;
  let luminanceSum = 0;
  let saturationSum = 0;
  let darkPixels = 0;
  let blueOrGrayPixels = 0;
  let luminanceSquareSum = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]; const green = data[index + 1]; const blue = data[index + 2];
    const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
    luminanceSum += luminance; luminanceSquareSum += luminance * luminance; saturationSum += saturation;
    if (luminance < 25) darkPixels += 1;
    if (saturation < 0.08 || (blue > red * 1.08 && blue > green * 1.03)) blueOrGrayPixels += 1;
  }
  const averageLuminance = luminanceSum / pixelCount;
  const brightness = averageLuminance / 255 * 100;
  const saturation = saturationSum / pixelCount * 100;
  const darkPixelRatio = darkPixels / pixelCount;
  const blueGrayRatio = blueOrGrayPixels / pixelCount;
  const standardDeviation = Math.sqrt(Math.max(0, luminanceSquareSum / pixelCount - averageLuminance ** 2));
  let viable = true; let reason: string | undefined;
  if (brightness < 7 || darkPixelRatio > 0.88) { viable = false; reason = "Image is overwhelmingly dark."; }
  else if (saturation < 1.5 && standardDeviation < 4) { viable = false; reason = "Image appears to be a flat grayscale placeholder."; }
  return {
    brightness: Math.round(brightness * 10) / 10,
    saturation: Math.round(saturation * 10) / 10,
    darkPixelRatio: Math.round(darkPixelRatio * 1000) / 1000,
    blueGrayRatio: Math.round(blueGrayRatio * 1000) / 1000,
    viable, status: viable ? "viable" : "rejected", reason,
  };
}

export async function fetchImageViability(imageUrl: string, timeoutMs = 8_000): Promise<ImageViability> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) return { ...UNAVAILABLE_IMAGE_VIABILITY, reason: `Image returned HTTP ${response.status}.` };
    return await analyzeImageBuffer(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return { ...UNAVAILABLE_IMAGE_VIABILITY, reason: error instanceof Error ? error.message : "Image check failed." };
  } finally { clearTimeout(timeout); }
}
