import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MeteoGaliciaWebcamProvider } from "../lib/providers/meteogalicia-webcam-provider";
import { mergeImportedCameras } from "../lib/camera-registry";
import { calculateCameraQuality } from "../lib/camera-quality";
import type { Camera } from "../types/camera";

async function main() {
  const target = path.join(process.cwd(), "data", "meteogalicia-cameras.json");
  const existing = JSON.parse(await readFile(target, "utf8")) as Camera[];
  const discovered = await new MeteoGaliciaWebcamProvider().discoverByBoundingBox({ north: 90, south: -90, west: -180, east: 180 });
  if (!discovered.length) throw new Error("No valid MeteoGalicia cameras returned; registry left unchanged");
  const now = new Date();
  const merged = mergeImportedCameras(existing, discovered).map((camera) => ({ ...camera,
    review: { ...camera.review, quality: calculateCameraQuality(camera, now),
      coverage: camera.review?.coverage ?? { strictSlotCount: 0, extendedSlotCount: 0, representativeDates: 0 } },
  }));
  await writeFile(target, JSON.stringify(merged, null, 2) + "\n");
  console.log(JSON.stringify({ imported: discovered.length, registryCount: merged.length,
    target, windyRequests: 0, imagesDownloaded: 0, discoveredAt: now.toISOString() }, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
