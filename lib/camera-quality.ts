import sharp from "sharp";
import { getCameraDirection } from "@/lib/camera-direction";
import type { Camera, CameraImageQuality, CameraQualityMetrics } from "@/types/camera";

const SCENIC_WEIGHTS: Record<string, number> = {
  landscape: 22, coast: 22, beach: 20, lake: 18, mountain: 18, forest: 12,
  river: 10, port: 8, village: 6, city: 3, meteo: 2, weather: 2,
};
const CATEGORY_PENALTIES: Record<string, number> = {
  indoor: 40, traffic: 20, building: 14, airport: 10, square: 8, sportarea: 8,
};
export const LIVE_CAPABILITY_QUALITY_BONUS = 3;

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export async function analyzeCameraQualityImage(buffer: Buffer): Promise<CameraImageQuality> {
  const { data, info } = await sharp(buffer).resize(160, 90, { fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3 || info.width < 2 || info.height < 2) return { skyShare: 0, openComposition: 0, edgeDensity: 1, artificialLightRatio: 0, score: 0, status: "unavailable", reason: "Invalid image pixels." };
  let skyPixels = 0; let topPixels = 0; let edgePixels = 0; let comparablePixels = 0; let artificialPixels = 0;
  const pixelCount = info.width * info.height;
  const luminance = (offset: number) => 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
      const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue);
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      const light = luminance(offset);
      if (y < info.height * 0.58) {
        topPixels += 1;
        const blueSky = blue > red * 1.05 && blue > green * 0.96;
        const cloudOrHaze = saturation < 0.16 && light > 55;
        const warmSky = red > blue * 1.12 && light > 45;
        if (blueSky || cloudOrHaze || warmSky) skyPixels += 1;
      }
      if (x > 0) {
        comparablePixels += 1;
        if (Math.abs(light - luminance(offset - info.channels)) > 32) edgePixels += 1;
      }
      if (y > info.height * 0.45 && light > 210 && saturation > 0.18) artificialPixels += 1;
    }
  }
  const skyShare = topPixels === 0 ? 0 : skyPixels / topPixels;
  const edgeDensity = comparablePixels === 0 ? 1 : edgePixels / comparablePixels;
  const openComposition = clamp(1 - edgeDensity * 4, 0, 1);
  const artificialLightRatio = artificialPixels / pixelCount;
  const score = clamp((skyShare * 52 + openComposition * 42 - artificialLightRatio * 180) * 100 / 94);
  return {
    skyShare: Math.round(skyShare * 1000) / 1000,
    openComposition: Math.round(openComposition * 1000) / 1000,
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    artificialLightRatio: Math.round(artificialLightRatio * 1000) / 1000,
    score: Math.round(score * 10) / 10, status: "analyzed",
  };
}

export async function fetchCameraQualityImage(imageUrl: string, timeoutMs = 8_000): Promise<CameraImageQuality> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) return { skyShare: 0, openComposition: 0, edgeDensity: 0, artificialLightRatio: 0, score: 0, status: "unavailable", reason: `HTTP ${response.status}` };
    return await analyzeCameraQualityImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return { skyShare: 0, openComposition: 0, edgeDensity: 0, artificialLightRatio: 0, score: 0, status: "unavailable", reason: error instanceof Error ? error.message : "Image request failed." };
  } finally { clearTimeout(timeout); }
}

export function calculateCameraQuality(camera: Camera, analyzedAt: Date, image?: CameraImageQuality): CameraQualityMetrics {
  const categories = new Set((camera.categories ?? []).map((category) => category.toLowerCase()));
  const scenicScore = clamp([...categories].reduce((best, category) => Math.max(best, SCENIC_WEIGHTS[category] ?? 0), 0), 0, 25);
  const categoryPenalty = [...categories].reduce((total, category) => total + (CATEGORY_PENALTIES[category] ?? 0), 0);
  const direction = getCameraDirection(camera);
  const directionScore = direction.viewAzimuth === undefined ? 4 : direction.confidence === "manual" || direction.confidence === "metadata" ? 10 : 8;
  const imageTimestamp = camera.lastKnownImageTimestamp ?? camera.imageUpdatedAt;
  const discoveryTimestamp = camera.discovery?.discoveredAt;
  let freshnessReliability = 4;
  if (imageTimestamp && discoveryTimestamp) {
    const ageMinutes = Math.max(0, (Date.parse(discoveryTimestamp) - Date.parse(imageTimestamp)) / 60_000);
    freshnessReliability = ageMinutes <= 30 ? 15 : ageMinutes <= 120 ? 11 : ageMinutes <= 720 ? 6 : 0;
  }
  const pixels = (camera.discovery?.imageWidth ?? 0) * (camera.discovery?.imageHeight ?? 0);
  const resolutionScore = pixels >= 1280 * 720 ? 10 : pixels >= 640 * 360 ? 7 : pixels > 0 ? 4 : 2;
  const liveCapabilityBonus = camera.hasLiveStream ? LIVE_CAPABILITY_QUALITY_BONUS : 0;
  const baseMetadataScore = clamp(45 + scenicScore + freshnessReliability + directionScore + resolutionScore - categoryPenalty);
  const metadataScore = clamp(baseMetadataScore + liveCapabilityBonus);
  const automaticScore = image?.status === "analyzed"
    ? baseMetadataScore * 0.72 + image.score * 0.28 + liveCapabilityBonus
    : metadataScore;
  const score = clamp(camera.manualQualityOverride ?? automaticScore);
  return {
    score: Math.round(score * 10) / 10, metadataScore: Math.round(metadataScore * 10) / 10,
    scenicScore, freshnessReliability, directionScore, resolutionScore, categoryPenalty, liveCapabilityBonus,
    image, imageTimestamp: camera.lastKnownImageTimestamp ?? camera.imageUpdatedAt, analyzedAt: analyzedAt.toISOString(),
  };
}
