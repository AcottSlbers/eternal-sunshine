import { sunsetGeometryScore, type SkyGeometry } from "@/lib/sky-geometry";
import { SUNSET_WINDOWS } from "@/lib/config";

export const EVIDENCE_PATHS = ["chromatic", "pastel", "luminous-horizon", "twilight", "solar-glow"] as const;
export type EvidencePath = typeof EVIDENCE_PATHS[number] | "none";
export interface EvidencePaths {
  chromaticEvidencePath: number;
  pastelEvidencePath: number;
  luminousHorizonEvidencePath: number;
  twilightEvidencePath: number;
  solarGlowEvidencePath: number;
}
export interface SolarImageContext {
  isSunSetting: boolean;
  solarElevation: number;
  solarAzimuth: number;
  cameraAzimuth?: number;
  horizontalFieldOfView?: number;
}
export interface LuminousEvidenceSupport {
  luminousHorizonEvidencePath: number;
  validatedHorizonLuminanceScore: number;
  evidenceSkyGeometry: number;
  evidenceForegroundLeakageRatio: number;
  evidenceHorizonWidth: number;
  skyConfidence: number;
  naturalSkySupport: number;
}

/** Strict alternative for a luminous scene narrowly attenuated by leakage/phase.
 * Admission still requires descending astronomy, a viable image and real Beauty.
 */
export function hasHighConfidenceLuminousEvidence(metrics: LuminousEvidenceSupport): boolean {
  if (![metrics.luminousHorizonEvidencePath, metrics.validatedHorizonLuminanceScore, metrics.evidenceSkyGeometry,
    metrics.evidenceForegroundLeakageRatio, metrics.evidenceHorizonWidth, metrics.skyConfidence, metrics.naturalSkySupport].every(Number.isFinite)) return false;
  return metrics.luminousHorizonEvidencePath >= 15 && metrics.validatedHorizonLuminanceScore >= 65
    && metrics.evidenceSkyGeometry >= 65 && metrics.skyConfidence >= 75
    && metrics.evidenceForegroundLeakageRatio <= .7 && metrics.evidenceHorizonWidth >= 35
    && metrics.naturalSkySupport >= 90;
}
export function primaryEvidencePath(paths: EvidencePaths): EvidencePath {
  const values = [paths.chromaticEvidencePath, paths.pastelEvidencePath, paths.luminousHorizonEvidencePath, paths.twilightEvidencePath, paths.solarGlowEvidencePath];
  const best = Math.max(...values);
  return best > 0 ? EVIDENCE_PATHS[values.indexOf(best)] : "none";
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const COLUMNS = 16;

/** Alternative visual paths share a conservative top-connected sky mask.
 * Neither brightness nor astronomy can create a path without a coherent color transition.
 */
export function measureEvidencePaths(data: Uint8Array, width: number, height: number, channels: number, geometry: SkyGeometry, chromatic: number, phase: number, context?: SolarImageContext) {
  const color = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    const r = data[i] / 255; const g = data[i + 1] / 255; const b = data[i + 2] / 255;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    return { light: .2126 * r + .7152 * g + .0722 * b, saturation: max ? (max - min) / max : 0,
      temperature: r - b, red: r, green: g, blue: b };
  };
  const boundary = [...geometry.boundary];
  // Follow bright, smooth, low-chroma sky a little farther down sloping skylines.
  // A dark edge or textured/saturated terrain stops extension immediately.
  for (let x = 0; x < width; x++) {
    for (let y = boundary[x]; y < Math.min(height - 1, geometry.boundary[x] + height * .12); y++) {
      const here = color(x, y); const above = color(x, Math.max(0, y - 2));
      const left = color(Math.max(0, x - 2), y); const right = color(Math.min(width - 1, x + 2), y);
      if (here.light < .5 || here.saturation > .28 || here.green > here.red * 1.06
        || Math.abs(here.light - above.light) > .12 || Math.abs(left.light - right.light) > .12) break;
      boundary[x] = y + 1;
    }
  }
  const columns = Array.from({ length: COLUMNS }, () => ({
    upperCount: 0, lowerCount: 0, upperLight: 0, lowerLight: 0, upperTemperature: 0, lowerTemperature: 0,
    lowerColor: 0, pastel: 0, purple: 0, blueUpper: 0, peak: 0,
  }));
  const mask = new Uint8Array(width * height);
  let skyColors = 0; let groundColors = 0; let skyLight = 0; let skyCount = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = color(x, y);
    const warm = c.red > c.blue + .025 && c.red >= c.green * .98 && c.green > c.blue;
    const pink = c.red > c.green * 1.07 && c.blue > c.green * 1.04 && c.red > c.blue * .8;
    const sunsetColor = (warm || pink) && c.saturation >= .055 && c.light >= .28;
    const inSky = y < boundary[x];
    if (sunsetColor) { if (inSky) { skyColors++; mask[y * width + x] = 1; } else groundColors++; }
    if (!inSky) continue;
    skyLight += c.light; skyCount++;
    const column = columns[Math.min(COLUMNS - 1, Math.floor(x / width * COLUMNS))];
    if (y < boundary[x] * .55) {
      column.upperCount++; column.upperLight += c.light; column.upperTemperature += c.temperature;
      if (c.blue > c.red * 1.04 && c.blue > c.green) column.blueUpper++;
    } else {
      column.lowerCount++; column.lowerLight += c.light; column.lowerTemperature += c.temperature;
      column.peak = Math.max(column.peak, c.light);
      if (sunsetColor) {
        column.lowerColor++;
        if (c.saturation <= .55) column.pastel++;
        if (pink) column.purple++;
      }
    }
  }
  const geometryScore = sunsetGeometryScore(mask, width, height, boundary) / 100;
  const leakage = skyColors + groundColors ? groundColors / (skyColors + groundColors) : 1;
  const profiles = columns.map(c => ({
    rise: c.lowerCount && c.upperCount ? c.lowerLight / c.lowerCount - c.upperLight / c.upperCount : 0,
    transition: c.lowerCount && c.upperCount ? c.lowerTemperature / c.lowerCount - c.upperTemperature / c.upperCount : 0,
    color: c.lowerCount ? c.lowerColor / c.lowerCount : 0,
    pastel: c.lowerCount ? c.pastel / c.lowerCount : 0,
    purple: c.lowerCount ? c.purple / c.lowerCount : 0,
    blue: c.upperCount ? c.blueUpper / c.upperCount : 0,
    peak: c.peak,
  }));
  const naturalSky = clamp(((skyCount ? skyLight / skyCount : 0) - .18) / .16);
  const astronomy = context && (!context.isSunSetting || !Number.isFinite(context.solarElevation)
    || context.solarElevation < SUNSET_WINDOWS.extended.minimumElevation
    || context.solarElevation > SUNSET_WINDOWS.extended.maximumElevation) ? 0 : .65 + .35 * clamp(phase / 100);
  const support = geometry.skyConfidence * geometryScore * naturalSky;
  // Leakage is measured with the same color definition on both sides of the mask.
  const skyDensity = skyCount ? skyColors / skyCount : 0;
  const groundCount = width * height - skyCount;
  const groundDensity = groundCount ? groundColors / groundCount : 0;
  const densityLeakage = skyDensity + groundDensity ? groundDensity / (skyDensity + groundDensity) : 1;
  const leakageSupport = clamp((.8 - Math.max(densityLeakage, leakage * (1 - geometryScore))) / .5);
  let pastel = 0; let luminous = 0; let twilight = 0; let bestGlow = 0;
  let coherentColumns = 0;
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const adjacent = Math.max(profiles[i - 1]?.color ?? 0, profiles[i + 1]?.color ?? 0);
    const coherence = clamp(Math.min(p.color, adjacent) / .12);
    const transition = clamp((p.transition - .035) / .18);
    if (coherence > .5 && transition > .15) coherentColumns++;
    pastel += coherence * transition * clamp(p.pastel / .25);
    luminous += coherence * transition * clamp((p.rise - .035) / .22);
    twilight += coherence * transition * clamp(p.blue / .3) * clamp(p.purple / .15);
    if (context?.cameraAzimuth !== undefined && context.horizontalFieldOfView !== undefined && context.horizontalFieldOfView > 0 && context.horizontalFieldOfView <= 180) {
      const difference = ((context.solarAzimuth - context.cameraAzimuth + 540) % 360) - 180;
      const expectedX = .5 + difference / context.horizontalFieldOfView;
      const aligned = Math.abs((i + .5) / COLUMNS - expectedX) < .12;
      if (aligned && expectedX >= 0 && expectedX <= 1 && context.solarElevation >= -1.5) {
        const surroundingPeak = Math.max(profiles[Math.max(0, i - 3)].peak, profiles[Math.min(COLUMNS - 1, i + 3)].peak);
        const localPeak = clamp((p.peak - surroundingPeak) / .08);
        bestGlow = Math.max(bestGlow, coherence * transition * localPeak * clamp((p.peak - .8) / .15) * clamp((p.rise - .06) / .2));
      }
    }
  }
  const spatialSupport = clamp(coherentColumns / 4);
  // A verified bright sky glow may coexist with reflected warm light on the ground.
  // This exception needs a broad, brightening chromatic sky transition, not ground color.
  const verifiedLuminousSky = clamp(luminous / 4) * spatialSupport * support;
  const luminousLeakageSupport = densityLeakage < .75
    ? Math.max(leakageSupport, .5 * verifiedLuminousSky ** 2) : leakageSupport;
  // A coherent local glow need not occupy most of the image width.
  const normalize = (sum: number, foregroundSupport = leakageSupport) => Math.min(65, clamp(sum / 4) * spatialSupport * support * foregroundSupport * 100) * astronomy;
  const paths: EvidencePaths = {
    chromaticEvidencePath: chromatic * naturalSky * (astronomy === 0 ? 0 : 1),
    pastelEvidencePath: normalize(pastel),
    luminousHorizonEvidencePath: normalize(luminous, luminousLeakageSupport),
    twilightEvidencePath: normalize(twilight),
    solarGlowEvidencePath: bestGlow * spatialSupport * support * leakageSupport * astronomy * 100,
  };
  // Independent paths cannot accumulate generic points to rescue a non-sunset.
  const evidence = Math.max(...Object.values(paths));
  return { paths, evidence, validatedHorizonLuminanceScore: verifiedLuminousSky * 100,
    naturalSkySupport: naturalSky * 100, evidenceSkyGeometry: geometryScore * 100,
    evidenceForegroundLeakageRatio: densityLeakage, evidenceHorizonWidth: coherentColumns / COLUMNS * 100 };
}
