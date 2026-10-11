import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OFFICIAL_PROVIDER_IDS, type OfficialProviderId } from "../lib/providers/catalogue";
import { OfficialWebcamProvider } from "../lib/providers/official-webcam-provider";
import { mergeImportedCameras } from "../lib/camera-registry";
import type { Camera } from "../types/camera";
async function main() {
  const requested = process.argv[2];
  if (requested && !OFFICIAL_PROVIDER_IDS.includes(requested as OfficialProviderId)) throw new Error(`Unknown provider: ${requested}`);
  const ids = requested ? [requested as OfficialProviderId] : OFFICIAL_PROVIDER_IDS;
  await mkdir("data/providers", { recursive: true });
  for (const id of ids) {
    const report: Record<string, unknown> = { provider: id, attemptedAt: new Date().toISOString() };
    try {
      const cameras = await new OfficialWebcamProvider(id).discoverByBoundingBox({ north: 90, south: -90, west: -180, east: 180 });
      const file = path.join("data/providers", `${id}-candidates.json`);
      let previous: Camera[] = []; try { previous = JSON.parse(await readFile(file, "utf8")); } catch {}
      await writeFile(file, JSON.stringify(mergeImportedCameras(previous, cameras), null, 2) + "\n");
      Object.assign(report, { status: cameras.length ? "discovered" : "no-verified-cameras", discovered: cameras.length, active: cameras.filter((c) => c.enabled).length });
    } catch (error) { Object.assign(report, { status: "blocked", error: error instanceof Error ? error.message : "Import failed", discovered: null }); }
    await writeFile(path.join("data/providers", `${id}-discovery.json`), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
