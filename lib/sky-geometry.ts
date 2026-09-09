/** Deterministic, deliberately conservative sky/terrain estimate on the small decoded image.
 * This is spatial evidence, not semantic segmentation: clouds, reflections and roofs remain
 * ambiguous. Confidence and the fixed-band fallback are exposed for manual diagnosis.
 */
export interface SkyGeometry {
  horizonY: number;
  confidence: number;
  skyConfidence: number;
  boundary: number[];
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function estimateSkyGeometry(pixels: Uint8Array, width: number, height: number, channels: number): SkyGeometry {
  const rows = Array.from({ length: height }, () => ({ red: 0, green: 0, blue: 0, light: 0, texture: 0 }));
  for (let y = 0; y < height; y++) {
    let previous = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const light = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      rows[y].red += pixels[i] / width;
      rows[y].green += pixels[i + 1] / width;
      rows[y].blue += pixels[i + 2] / width;
      rows[y].light += light / width;
      if (x) rows[y].texture += Math.abs(light - previous) / (width - 1);
      previous = light;
    }
  }
  function average(from: number, to: number) {
    const selected = rows.slice(Math.max(0, from), Math.min(height, to));
    return selected.reduce((sum, row) => ({ red: sum.red + row.red / selected.length,
      green: sum.green + row.green / selected.length, blue: sum.blue + row.blue / selected.length,
      light: sum.light + row.light / selected.length, texture: sum.texture + row.texture / selected.length,
    }), { red: 0, green: 0, blue: 0, light: 0, texture: 0 });
  }
  const band = Math.max(2, Math.round(height * .025));
  let bestY = Math.round(height * .7);
  let bestScore = 0;
  for (let y = Math.round(height * .2); y < height * .87; y++) {
    const above = average(y - band * 2, y);
    const below = average(y, y + band * 3);
    const drop = clamp((above.light - below.light) / 70);
    const textureRise = clamp((below.texture - above.texture) / 14);
    const distance = clamp(Math.hypot(above.red - below.red, above.green - below.green, above.blue - below.blue) / 110);
    const greenGround = below.green > below.red * 1.08 && below.green > below.blue * 1.08 ? 1 : 0;
    const warmGround = below.red > below.blue * 1.22 && below.green > below.blue * 1.1 && below.light < 160 ? 1 : 0;
    // Brightening into orange/pink lower sky alone is not a ground transition.
    const terrain = Math.max(drop, textureRise * .7, greenGround * .7, warmGround * drop);
    const score = terrain * (.45 + .55 * distance) + .12 * textureRise;
    if (score > bestScore) { bestScore = score; bestY = y; }
  }
  const confidence = clamp((bestScore - .12) / .58);
  if (confidence < .25) bestY = Math.round(height * .7);
  const upper = average(0, Math.max(1, Math.round(bestY * .6)));
  const skyConfidence = clamp((1 - upper.texture / 32) * (.45 + .55 * confidence));
  // Follow local ridgelines near the broad transition, so diagonal mountain/roof
  // edges do not expose an entire rectangular band of foreground as sky.
  const boundary = Array.from({ length: width }, () => bestY);
  if (confidence >= .25) {
    const span = Math.max(2, Math.round(width / 24));
    for (let x = 0; x < width; x += span) {
      let localBest = 0;
      let localY = bestY;
      const endX = Math.min(width, x + span);
      for (let y = Math.max(band, bestY - band * 3); y <= Math.min(height - band, bestY + band * 2); y++) {
        let difference = 0;
        for (let sx = x; sx < endX; sx++) {
          const a = ((y - band) * width + sx) * channels;
          const b = ((y + band - 1) * width + sx) * channels;
          difference += Math.max(0, .2126 * (pixels[a] - pixels[b]) + .7152 * (pixels[a + 1] - pixels[b + 1]) + .0722 * (pixels[a + 2] - pixels[b + 2]));
        }
        const score = difference / (endX - x) - Math.abs(y - bestY) * 1.5;
        if (score > localBest) { localBest = score; localY = y; }
      }
      for (let sx = x; sx < endX; sx++) boundary[sx] = localY;
    }
  }
  return { horizonY: bestY / height, confidence, skyConfidence, boundary };
}

export function sunsetGeometryScore(mask: Uint8Array, width: number, height: number, boundary: number[]): number {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0; let tail = 1; queue[0] = start; visited[start] = 1;
    let minX = width; let maxX = 0; let nearHorizon = 0;
    while (head < tail) {
      const index = queue[head++]; const x = index % width; const y = Math.floor(index / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      if (y >= boundary[x] * .6 && y < boundary[x]) nearHorizon++;
      const neighbors = [x ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y ? index - width : -1, y < height - 1 ? index + width : -1];
      for (const next of neighbors) if (next >= 0 && mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
    }
    if (tail < Math.max(6, width * height * .0007)) continue;
    const horizontal = clamp((maxX - minX + 1) / (width * .6));
    const size = clamp(tail / (width * height * .012));
    const horizonSupport = .4 + .6 * Math.min(1, nearHorizon / tail * 2);
    best = Math.max(best, Math.sqrt(horizontal * size) * horizonSupport);
  }
  return 100 * best;
}
