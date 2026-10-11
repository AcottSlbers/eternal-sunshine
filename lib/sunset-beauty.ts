import { sunsetGeometryScore, type SkyGeometry } from "@/lib/sky-geometry";

export interface SunsetBeautyMetrics {
  pastelSunsetScore: number;
  horizonIlluminationWidthScore: number;
  illuminatedCloudScore: number;
  verticalSunsetGradientScore: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const COLUMNS = 16;
const BANDS = 8;

/** Quality measurements only: none of these signals can admit an image through Evidence. */
export function measureSunsetBeauty(pixels: Uint8Array, width: number, height: number, channels: number, geometry: SkyGeometry): SunsetBeautyMetrics {
  const cells = Array.from({ length: COLUMNS }, () => Array.from({ length: BANDS }, () => ({
    count: 0, lit: 0, pastel: 0, light: 0, temperature: 0,
  })));
  const illuminationMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y >= geometry.boundary[x]) continue;
      const offset = (y * width + x) * channels;
      const r = pixels[offset] / 255; const g = pixels[offset + 1] / 255; const b = pixels[offset + 2] / 255;
      const maximum = Math.max(r, g, b); const delta = maximum - Math.min(r, g, b);
      const saturation = maximum ? delta / maximum : 0;
      let hue = delta === 0 ? 0 : maximum === r ? 60 * ((g - b) / delta % 6) : maximum === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
      const light = .2126 * r + .7152 * g + .0722 * b;
      const lit = (hue < 65 || hue >= 265) && saturation >= .12 && maximum >= .35 && light >= .22;
      const column = Math.min(COLUMNS - 1, Math.floor(x / width * COLUMNS));
      const band = Math.min(BANDS - 1, Math.floor(y / geometry.boundary[x] * BANDS));
      const cell = cells[column][band];
      cell.count++;
      cell.light += light;
      cell.temperature += r - b;
      if (lit) {
        cell.lit++;
        if (saturation <= .55 && light >= .4) cell.pastel++;
        illuminationMask[y * width + x] = 1;
      }
    }
  }
  const support = Math.sqrt(geometry.skyConfidence * sunsetGeometryScore(illuminationMask, width, height, geometry.boundary) / 100);
  const profiles = cells.map(column => column.map(cell => ({
    lit: cell.count ? cell.lit / cell.count : 0,
    pastel: cell.count ? cell.pastel / cell.count : 0,
    light: cell.count ? cell.light / cell.count : 0,
    temperature: cell.count ? cell.temperature / cell.count : 0,
  })));

  let pastel = 0; let gradient = 0; let cloud = 0;
  const illuminatedColumns: boolean[] = [];
  for (const column of profiles) {
    const lower = column.slice(4);
    const lowerLit = lower.reduce((sum, cell) => sum + cell.lit, 0) / lower.length;
    // A narrow strip can cover a wide horizon; total warm area in the frame is irrelevant.
    illuminatedColumns.push(lowerLit >= .1);
    pastel += clamp(lower.reduce((sum, cell) => sum + cell.pastel, 0) / lower.length / .35);
    let positive = 0; let travel = 0; let lightRise = 0; let lightTravel = 0;
    for (let band = 1; band < BANDS; band++) {
      const change = column[band].temperature - column[band - 1].temperature;
      positive += Math.max(0, change);
      travel += Math.abs(change);
      const lightChange = column[band].light - column[band - 1].light;
      lightRise += Math.max(0, lightChange);
      lightTravel += Math.abs(lightChange);
    }
    const upperTemperature = (column[0].temperature + column[1].temperature) / 2;
    const lowerTemperature = (column[6].temperature + column[7].temperature) / 2;
    const progression = clamp((lowerTemperature - upperTemperature) / .45);
    const lightProgression = lightTravel ? lightRise / lightTravel * clamp(lightRise / .3) : 0;
    gradient += progression * (travel ? positive / travel : 0) * clamp(lowerLit / .2) * (.85 + .15 * lightProgression);

    let cloudStructure = 0;
    // A darker band bounded by illuminated sky, rather than arbitrary gray texture.
    for (let band = 1; band < BANDS - 1; band++) {
      const above = column[band - 1]; const center = column[band]; const below = column[band + 1];
      const valley = Math.max(0, Math.min(above.light, below.light) - center.light);
      const coloredEdges = Math.sqrt(above.lit * below.lit);
      cloudStructure = Math.max(cloudStructure, clamp(valley / .12) * coloredEdges);
    }
    cloud += cloudStructure;
  }
  let longestRun = 0; let run = 0;
  for (const lit of illuminatedColumns) { run = lit ? run + 1 : 0; longestRun = Math.max(longestRun, run); }
  const widthScore = longestRun / COLUMNS;
  return {
    pastelSunsetScore: 100 * pastel / COLUMNS * support,
    horizonIlluminationWidthScore: 100 * widthScore * support,
    illuminatedCloudScore: 100 * cloud / COLUMNS * support,
    verticalSunsetGradientScore: 100 * gradient / COLUMNS * support,
  };
}
