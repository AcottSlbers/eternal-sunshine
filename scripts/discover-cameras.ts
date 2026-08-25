import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { CAMERAS_PER_BUCKET, LONGITUDE_BUCKET_COUNT, getLongitudeBucket, scoreCameraCandidate, selectDistributedPool } from "../lib/camera-discovery";
import { WindyConfigurationError, WindyWebcamProvider } from "../lib/providers/windy-webcam-provider";
import type { Camera } from "../types/camera";

const root = process.cwd();
const dataDirectory = path.join(root, "data");
const candidatesPath = path.join(dataDirectory, "camera-candidates.json");
const registryPath = path.join(dataDirectory, "cameras.json");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

async function readExistingRegistry(): Promise<Camera[]> {
  try { return JSON.parse(await readFile(registryPath, "utf8")) as Camera[]; } catch { return []; }
}

function preserveCuration(discovered: Camera, existing?: Camera): Camera {
  if (!existing || existing.source !== "windy") return discovered;
  return { ...discovered, enabled: existing.enabled, qualityWeight: existing.qualityWeight, notes: existing.notes, direction: existing.direction };
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
  const unique = [...new Map(all.map((camera) => [camera.id, camera])).values()];
  const selected = selectDistributedPool(unique, CAMERAS_PER_BUCKET);
  const existing = await readExistingRegistry();
  const existingById = new Map(existing.map((camera) => [camera.id, camera]));
  const registry = selected.map((camera) => preserveCuration(camera, existingById.get(camera.id)));
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(candidatesPath, `${JSON.stringify(unique, null, 2)}\n`, "utf8");
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  console.log(`Discovery complete: ${unique.length} candidates, ${registry.length} selected for the registry.`);
  if (registry.length < 80) console.warn("Coverage is below target. Review camera-candidates.json and curate sparse longitude buckets manually.");
}

void main();
