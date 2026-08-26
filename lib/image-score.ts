import sharp from "sharp";
import { analyzeImageBuffer, UNAVAILABLE_IMAGE_VIABILITY } from "@/lib/image-viability";
import type { ImageViability, SunsetScoreMetrics, VisualSunsetScore } from "@/types/ranking";

const WIDTH = 256;
const HEIGHT = 144;

interface RegionAccumulator {
  pixels: number;
  warm: number;
  pinkPurple: number;
  sunset: number;
  twilightBlue: number;
  luminanceSum: number;
  redSum: number;
  greenSum: number;
  blueSum: number;
  saturationSum: number;
  sunsetSaturationSum: number;
  hueBins: number[];
  edges: number;
  comparisons: number;
}

interface HsvColor { hue: number; saturation: number; value: number }

export interface CandidateImageAnalysis {
  viability: ImageViability;
  visual: VisualSunsetScore;
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const round = (value: number) => Math.round(value * 10) / 10;
const share = (count: number, total: number) => total === 0 ? 0 : count / total;
const smoothstep = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

function createRegion(): RegionAccumulator {
  return { pixels: 0, warm: 0, pinkPurple: 0, sunset: 0, twilightBlue: 0, luminanceSum: 0, redSum: 0, greenSum: 0, blueSum: 0, saturationSum: 0, sunsetSaturationSum: 0, hueBins: [0, 0, 0, 0, 0], edges: 0, comparisons: 0 };
}

function toHsv(red: number, green: number, blue: number): HsvColor {
  const r = red / 255; const g = green / 255; const b = blue / 255;
  const maximum = Math.max(r, g, b); const minimum = Math.min(r, g, b); const delta = maximum - minimum;
  let hue = 0;
  if (delta > 0) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation: maximum === 0 ? 0 : delta / maximum, value: maximum };
}

function classifyHue(color: HsvColor): { warm: boolean; pinkPurple: boolean; sunset: boolean; twilightBlue: boolean; bin?: number } {
  const chromatic = color.saturation >= 0.22 && color.value >= 0.16;
  const warm = chromatic && (color.hue < 62 || color.hue >= 345);
  const pink = chromatic && color.hue >= 315 && color.hue < 345;
  const violet = color.saturation >= 0.17 && color.value >= 0.2 && color.hue >= 255 && color.hue < 315;
  const pinkPurple = pink || violet;
  const twilightBlue = color.saturation >= 0.16 && color.value >= 0.1 && color.hue >= 190 && color.hue < 255;
  let bin: number | undefined;
  if (warm && (color.hue >= 345 || color.hue < 12)) bin = 0;
  else if (warm && color.hue < 35) bin = 1;
  else if (warm) bin = 2;
  else if (pink) bin = 3;
  else if (violet) bin = 4;
  return { warm, pinkPurple, sunset: warm || pinkPurple, twilightBlue, bin };
}

function addPixel(region: RegionAccumulator, red: number, green: number, blue: number, luminance: number, color: HsvColor, previousLuminance?: number) {
  const classification = classifyHue(color);
  region.pixels += 1;
  region.luminanceSum += luminance;
  region.redSum += red / 255; region.greenSum += green / 255; region.blueSum += blue / 255;
  region.saturationSum += color.saturation;
  if (classification.warm) region.warm += 1;
  if (classification.pinkPurple) region.pinkPurple += 1;
  if (classification.twilightBlue) region.twilightBlue += 1;
  if (classification.sunset) {
    region.sunset += 1;
    region.sunsetSaturationSum += color.saturation;
    if (classification.bin !== undefined) region.hueBins[classification.bin] += 1;
  }
  if (previousLuminance !== undefined) {
    region.comparisons += 1;
    if (Math.abs(luminance - previousLuminance) > 24) region.edges += 1;
  }
}

function regionMean(region: RegionAccumulator, field: "luminanceSum" | "redSum" | "greenSum" | "blueSum"): number {
  return region.pixels === 0 ? 0 : region[field] / region.pixels;
}

function unavailableVisualScore(reason: string): VisualSunsetScore {
  const metrics: SunsetScoreMetrics = {
    upperSkyWarmShare: 0, horizonWarmShare: 0, upperSkyPinkPurpleShare: 0, horizonPinkPurpleShare: 0,
    foregroundSunsetColorShare: 0, sunsetColorConcentration: 0, localizedSunsetPresence: 0, sunsetColorDiversity: 0, sunsetColorStrength: 0,
    horizonGlow: 0, chromaticDifference: 0, chromaticHorizonCoherence: 0, luminanceContrast: 0, dynamicRange: 0, textureEnhancement: 0,
    averageLuminance: 0, grayscaleShare: 0, darkPixelShare: 0, overexposedShare: 0, foregroundWarmPenalty: 0,
    astronomicalPlausibility: 0, evidenceGateCeiling: 0,
  };
  return { sunsetEvidenceScore: 0, sunsetBeautyScore: 0, sunsetScore: 0, metrics, status: "unavailable", reason };
}

export const UNAVAILABLE_VISUAL_SUNSET_SCORE = unavailableVisualScore("Image could not be scored.");

export async function analyzeSunsetImage(buffer: Buffer, sunsetPhaseScore: number): Promise<VisualSunsetScore> {
  const { data, info } = await sharp(buffer).resize(WIDTH, HEIGHT, { fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3 || info.width < 2 || info.height < 2) return unavailableVisualScore("Invalid image pixels.");

  const upperSky = createRegion(); const horizon = createRegion(); const foreground = createRegion();
  const localUpperSky = Array.from({ length: 8 }, createRegion); const localHorizon = Array.from({ length: 8 }, createRegion);
  const luminanceHistogram = new Uint32Array(256);
  let luminanceSum = 0; let luminanceSquareSum = 0; let darkPixels = 0; let grayscalePixels = 0; let overexposedPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    let previousLuminance: number | undefined;
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const color = toHsv(red, green, blue);
      const yRatio = y / info.height;
      const region = yRatio < 0.42 ? upperSky : yRatio < 0.7 ? horizon : foreground;
      addPixel(region, red, green, blue, luminance, color, previousLuminance);
      const column = Math.min(7, Math.floor(x / info.width * 8));
      if (yRatio < 0.42) addPixel(localUpperSky[column], red, green, blue, luminance, color);
      else if (yRatio < 0.7) addPixel(localHorizon[column], red, green, blue, luminance, color);
      previousLuminance = luminance;
      const roundedLuminance = Math.max(0, Math.min(255, Math.round(luminance)));
      luminanceHistogram[roundedLuminance] += 1;
      luminanceSum += luminance; luminanceSquareSum += luminance * luminance;
      if (luminance < 24) darkPixels += 1;
      if (color.saturation < 0.08) grayscalePixels += 1;
      if (luminance > 246 && color.saturation < 0.12) overexposedPixels += 1;
    }
  }

  const pixelCount = info.width * info.height;
  const skyHorizonPixels = upperSky.pixels + horizon.pixels;
  const upperWarm = share(upperSky.warm, upperSky.pixels); const horizonWarm = share(horizon.warm, horizon.pixels);
  const upperPinkPurple = share(upperSky.pinkPurple, upperSky.pixels); const horizonPinkPurple = share(horizon.pinkPurple, horizon.pixels);
  const upperSunset = share(upperSky.sunset, upperSky.pixels); const horizonSunset = share(horizon.sunset, horizon.pixels);
  const foregroundSunset = share(foreground.sunset, foreground.pixels);
  const weightedSunsetPresence = 0.32 * upperSunset + 0.68 * horizonSunset;
  const weightedPinkPresence = 0.32 * upperPinkPurple + 0.68 * horizonPinkPurple;
  const skyHorizonSunsetPixels = upperSky.sunset + horizon.sunset;
  const allSunsetPixels = skyHorizonSunsetPixels + foreground.sunset;
  const concentration = allSunsetPixels === 0 ? 0 : skyHorizonSunsetPixels / allSunsetPixels;
  const sunsetSaturation = skyHorizonSunsetPixels === 0 ? 0 : (upperSky.sunsetSaturationSum + horizon.sunsetSaturationSum) / skyHorizonSunsetPixels;
  const sunsetColorStrength = clamp((sunsetSaturation - 0.16) / 0.56 * 100);
  const presenceScore = 100 * (1 - Math.exp(-3.4 * weightedSunsetPresence)) * (0.62 + 0.38 * sunsetColorStrength / 100);
  const concentratedPresence = presenceScore * (0.42 + 0.58 * concentration);

  let strongestLocalPresence = 0; let strongestLocalGlow = 0;
  for (let column = 0; column < localUpperSky.length; column += 1) {
    const localUpper = localUpperSky[column]; const localBand = localHorizon[column];
    const localUpperSunset = share(localUpper.sunset, localUpper.pixels); const localHorizonSunset = share(localBand.sunset, localBand.pixels);
    const localWeightedPresence = 0.32 * localUpperSunset + 0.68 * localHorizonSunset;
    const localSunsetPixels = localUpper.sunset + localBand.sunset;
    const localSaturation = localSunsetPixels === 0 ? 0 : (localUpper.sunsetSaturationSum + localBand.sunsetSaturationSum) / localSunsetPixels;
    const localStrength = clamp((localSaturation - 0.16) / 0.56 * 100);
    const localPresence = 100 * (1 - Math.exp(-3.4 * localWeightedPresence)) * (0.62 + 0.38 * localStrength / 100);
    strongestLocalPresence = Math.max(strongestLocalPresence, localPresence);
    const localBrightness = clamp((regionMean(localBand, "luminanceSum") - regionMean(localUpper, "luminanceSum") + 4) / 72 * 100);
    const localColorPresence = 100 * (1 - Math.exp(-6 * localHorizonSunset));
    strongestLocalGlow = Math.max(strongestLocalGlow, Math.sqrt(localBrightness * localColorPresence));
  }
  const localizedSunsetPresence = strongestLocalPresence * (0.35 + 0.65 * concentration ** 1.5);
  const spatialPresence = Math.max(concentratedPresence, localizedSunsetPresence);

  const upperLuminance = regionMean(upperSky, "luminanceSum"); const horizonLuminance = regionMean(horizon, "luminanceSum");
  const glowBrightness = clamp((horizonLuminance - upperLuminance + 4) / 72 * 100);
  const glowColorPresence = 100 * (1 - Math.exp(-6 * horizonSunset));
  const horizonGlow = Math.max(Math.sqrt(glowBrightness * glowColorPresence), strongestLocalGlow);

  const colorDistance = Math.sqrt(
    (regionMean(horizon, "redSum") - regionMean(upperSky, "redSum")) ** 2
    + (regionMean(horizon, "greenSum") - regionMean(upperSky, "greenSum")) ** 2
    + (regionMean(horizon, "blueSum") - regionMean(upperSky, "blueSum")) ** 2
  ) / Math.sqrt(3) * 230;
  const chromaticDifference = clamp(colorDistance) * Math.min(1, weightedSunsetPresence * 7);
  const chromaticHorizonCoherence = chromaticDifference * concentration * smoothstep((localizedSunsetPresence - 25) / 45);

  const hueBins = upperSky.hueBins.map((count, index) => count + horizon.hueBins[index]);
  const activeThreshold = Math.max(4, skyHorizonPixels * 0.004);
  const activeSunsetBins = hueBins.filter((count) => count >= activeThreshold).length;
  const twilightBlueShare = share(upperSky.twilightBlue + horizon.twilightBlue, skyHorizonPixels);
  const diversityByBins = [0, 18, 45, 72, 90, 100][activeSunsetBins] ?? 100;
  const diversityPresenceFactor = Math.min(1, share(skyHorizonSunsetPixels, skyHorizonPixels) / 0.1);
  const sunsetColorDiversity = clamp((diversityByBins + (activeSunsetBins > 0 && twilightBlueShare > 0.03 ? 8 : 0)) * diversityPresenceFactor);

  const foregroundExcess = Math.max(0, foregroundSunset - (upperSunset + horizonSunset) * 0.65);
  const foregroundWarmPenalty = clamp(foregroundExcess * 190 + (weightedSunsetPresence < 0.015 ? foregroundSunset * 180 : 0), 0, 45);
  const astronomicalPlausibility = clamp(sunsetPhaseScore);
  const grayscaleShare = share(grayscalePixels, pixelCount); const darkPixelShare = share(darkPixels, pixelCount); const overexposedShare = share(overexposedPixels, pixelCount);
  const grayscaleEvidencePenalty = clamp((grayscaleShare - 0.72) / 0.28 * 28);
  const astronomicalFactor = 0.65 + 0.35 * astronomicalPlausibility / 100;
  const pinkEvidence = 100 * (1 - Math.exp(-5 * weightedPinkPresence));
  const rawEvidence = 0.52 * spatialPresence + 0.16 * horizonGlow + 0.14 * chromaticDifference + 0.1 * sunsetColorDiversity + 0.08 * pinkEvidence + 0.2 * chromaticHorizonCoherence;
  const sunsetEvidenceScore = clamp(rawEvidence * astronomicalFactor - foregroundWarmPenalty - grayscaleEvidencePenalty);

  const averageLuminance = luminanceSum / pixelCount;
  const luminanceDeviation = Math.sqrt(Math.max(0, luminanceSquareSum / pixelCount - averageLuminance ** 2));
  const luminanceContrast = clamp(luminanceDeviation / 64 * 100);
  let cumulative = 0; let percentile10 = 0; let percentile90 = 255; let foundPercentile10 = false;
  for (let value = 0; value < 256; value += 1) {
    cumulative += luminanceHistogram[value];
    if (cumulative >= pixelCount * 0.1 && !foundPercentile10) { percentile10 = value; foundPercentile10 = true; }
    if (cumulative >= pixelCount * 0.9) { percentile90 = value; break; }
  }
  const dynamicRange = clamp((percentile90 - percentile10) / 180 * 100);
  const textureEnhancement = clamp(share(upperSky.edges + horizon.edges, upperSky.comparisons + horizon.comparisons) / 0.16 * 100);
  const rawBeauty = 0.27 * sunsetColorDiversity + 0.22 * sunsetColorStrength + 0.2 * horizonGlow + 0.15 * chromaticDifference + 0.08 * luminanceContrast + 0.05 * dynamicRange + 0.03 * textureEnhancement;
  const beautyActivation = smoothstep((sunsetEvidenceScore - 8) / 52);
  const exposurePenalty = clamp((overexposedShare - 0.18) / 0.5 * 35);
  const darknessPenalty = clamp((darkPixelShare - 0.72) / 0.28 * 35);
  const sunsetBeautyScore = clamp(rawBeauty * beautyActivation - exposurePenalty - darknessPenalty);
  const evidenceGateCeiling = 100 * Math.sin(sunsetEvidenceScore / 100 * Math.PI / 2) ** 1.18;
  const ungatedScore = 0.7 * sunsetEvidenceScore + 0.3 * sunsetBeautyScore;
  const sunsetScore = Math.min(ungatedScore, evidenceGateCeiling);

  return {
    sunsetEvidenceScore: round(sunsetEvidenceScore), sunsetBeautyScore: round(sunsetBeautyScore), sunsetScore: round(sunsetScore), status: "analyzed",
    metrics: {
      upperSkyWarmShare: round(upperWarm * 100), horizonWarmShare: round(horizonWarm * 100),
      upperSkyPinkPurpleShare: round(upperPinkPurple * 100), horizonPinkPurpleShare: round(horizonPinkPurple * 100),
      foregroundSunsetColorShare: round(foregroundSunset * 100), sunsetColorConcentration: round(concentration * 100), localizedSunsetPresence: round(localizedSunsetPresence),
      sunsetColorDiversity: round(sunsetColorDiversity), sunsetColorStrength: round(sunsetColorStrength),
      horizonGlow: round(horizonGlow), chromaticDifference: round(chromaticDifference), chromaticHorizonCoherence: round(chromaticHorizonCoherence), luminanceContrast: round(luminanceContrast),
      dynamicRange: round(dynamicRange), textureEnhancement: round(textureEnhancement), averageLuminance: round(averageLuminance / 255 * 100),
      grayscaleShare: round(grayscaleShare * 100), darkPixelShare: round(darkPixelShare * 100), overexposedShare: round(overexposedShare * 100),
      foregroundWarmPenalty: round(foregroundWarmPenalty), astronomicalPlausibility: round(astronomicalPlausibility), evidenceGateCeiling: round(evidenceGateCeiling),
    },
  };
}

export async function fetchCandidateImageAnalysis(imageUrl: string, sunsetPhaseScore: number, timeoutMs = 8_000): Promise<CandidateImageAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) {
      const reason = `Image returned HTTP ${response.status}.`;
      return { viability: { ...UNAVAILABLE_IMAGE_VIABILITY, reason }, visual: unavailableVisualScore(reason) };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const [viabilityResult, visualResult] = await Promise.allSettled([analyzeImageBuffer(buffer), analyzeSunsetImage(buffer, sunsetPhaseScore)]);
    const viability = viabilityResult.status === "fulfilled" ? viabilityResult.value : { ...UNAVAILABLE_IMAGE_VIABILITY, reason: "Image viability analysis failed." };
    const visual = visualResult.status === "fulfilled" ? visualResult.value : unavailableVisualScore("Sunset image analysis failed.");
    return { viability, visual };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Image request failed.";
    return { viability: { ...UNAVAILABLE_IMAGE_VIABILITY, reason }, visual: unavailableVisualScore(reason) };
  } finally {
    clearTimeout(timeout);
  }
}
