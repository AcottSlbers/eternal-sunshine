import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { LONGITUDE_BUCKET_COUNT, getLongitudeBucket, scoreCameraCandidate } from "../lib/camera-discovery";
import { WindyConfigurationError, WindyWebcamProvider } from "../lib/providers/windy-webcam-provider";
import type { Camera } from "../types/camera";

const root = process.cwd();
const dataDirectory = path.join(root, "data");
const candidatesPath = path.join(dataDirectory, "camera-candidates.json");
const reviewedPath = path.join(dataDirectory, "cameras-reviewed.json");
const registryPath = path.join(dataDirectory, "cameras.json");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

async function readCameras(file: string): Promise<Camera[]> {
  try { return JSON.parse(await readFile(file, "utf8")) as Camera[]; } catch { return []; }
}

function preserveCuration(discovered: Camera, sources: Array<Camera | undefined>): Camera {
  const output = { ...discovered };
  const fields = ["enabled", "qualityWeight", "manualQualityOverride", "manualViewAzimuth", "manualDirectionConfidence", "notes", "permanentlyRejected"] as const;
  for (const source of sources) for (const field of fields) if (source && source[field] !== undefined) Object.assign(output, { [field]: source[field] });
  return output;
}

async function main() {
  let provider: WindyWebcamProvider;
  try { provider = new WindyWebcamProvider(); } catch (error) {
    if (error instanceof WindyConfigurationError) { console.error(error.message); process.exitCode = 1; return; }
    throw error;
  }
  const discoveredAt = new Date();
  const all: Camera[] = [];
  for (let bucket = 0; bucket < LONGITUDE_BUCKET_COUNT; bucket += 1) {
    const west = -180 + bucket * 15;
    const east = west + 15;
    try {
      const cameras = await provider.discoverByBoundingBox({ north: 85, east, south: -85, west }, 50);
      const scored = cameras.map((camera) => {
        const base = { ...camera, discovery: { longitudeBucket: getLongitudeBucket(camera.longitude), discoveredAt: discoveredAt.toISOString(), candidateScore: scoreCameraCandidate(camera, discoveredAt) } };
        return { ...base, discovery: { ...base.discovery, candidateScore: scoreCameraCandidate(base, discoveredAt) } };
      });
      all.push(...scored);
      console.log(`Bucket ${String(bucket + 1).padStart(2, "0")}/24 (${west}..${east}): ${scored.length} valid cameras`);
    } catch (error) { console.error(`Bucket ${bucket + 1} failed:`, error instanceof Error ? error.message : error); }
  }
  const [existingCandidates, existingReviewed, existingGold] = await Promise.all([readCameras(candidatesPath), readCameras(reviewedPath), readCameras(registryPath)]);
  const candidateMap = new Map(existingCandidates.map((camera) => [camera.id, camera]));
  const reviewedMap = new Map(existingReviewed.map((camera) => [camera.id, camera]));
  const goldMap = new Map(existingGold.map((camera) => [camera.id, camera]));
  const unique = [...new Map(all.map((camera) => [camera.id, camera])).values()].map((camera) => preserveCuration(camera, [candidateMap.get(camera.id), reviewedMap.get(camera.id), goldMap.get(camera.id)]));
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(candidatesPath, `${JSON.stringify(unique, null, 2)}\n`, "utf8");
  console.log(`Discovery complete: ${unique.length} candidates saved without reducing the pool.`);
  console.log("Run npm run build-camera-registry to review quality, simulate coverage, and rebuild the Gold Registry.");
}

void main();
