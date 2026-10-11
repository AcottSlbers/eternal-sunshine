import { config } from "dotenv";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { OFFICIAL_PROVIDER_IDS, PROVIDERS, type OfficialProviderId } from "../lib/providers/catalogue";
import { OfficialWebcamProvider } from "../lib/providers/official-webcam-provider";
import { fetchProviderImage } from "../lib/providers/image-cache";
import { analyzeCameraQualityImage, calculateCameraQuality } from "../lib/camera-quality";
import { getLongitudeBucket, scoreCameraCandidate } from "../lib/camera-discovery";
import { benchmarkSummary, type CameraProbe } from "../lib/provider-benchmark";
import type { Camera } from "../types/camera";
config({ path: ".env.local", quiet: true });
async function benchmark(id: OfficialProviderId) {
  let cameras: Camera[];
  try { cameras = JSON.parse(await readFile(`data/providers/${id}-candidates.json`,"utf8")); }
  catch { console.log(`${id}: no candidate file (access/research blocked)`); return; }
  const results: Camera[] = []; const probes: CameraProbe[] = []; const provider = new OfficialWebcamProvider(id);
  let lastRefresh = 0; let fresh = new Map<string, Camera>();
  const startedAt = new Date().toISOString();
  for (const original of cameras) {
    let camera = original;
    if (id === "digitraffic" && Date.now()-lastRefresh>10*60_000) {
      try { fresh = new Map((await provider.getCameras(cameras.map((c)=>c.id))).map((c)=>[c.id,c])); lastRefresh=Date.now(); } catch {}
    }
    if (fresh.has(camera.id)) camera = { ...camera, imageUpdatedAt: fresh.get(camera.id)?.imageUpdatedAt };
    const probe: CameraProbe = { cameraId: camera.id, attempted: false, reachable: false, fresh: false, etag: false, timestampKnown: false };
    const imageUrl = camera.imageUrl;
    if (imageUrl && camera.supportsVisualScoring !== false && camera.enabled) {
      probe.attempted = true;
      try {
        const image = await fetchProviderImage(id, imageUrl);
        const metadata = await sharp(image.buffer).metadata();
        const now = new Date(); const updated = camera.imageUpdatedAt ?? image.timestamp;
        const age = updated ? (now.getTime()-Date.parse(updated))/60_000 : Infinity;
        Object.assign(probe, { reachable: true, fresh: age>=-5 && age<=PROVIDERS[id].maximumImageAgeMinutes, timestampKnown: Number.isFinite(age), width: metadata.width, height: metadata.height, etag: Boolean(image.etag || image.modified) });
        camera = { ...camera, imageUpdatedAt: updated, timestampSource: camera.timestampSource ?? (image.timestamp ? "http-last-modified" : undefined),
          lastKnownImageUrl: imageUrl, lastKnownImageTimestamp: updated,
          discovery: { longitudeBucket: getLongitudeBucket(camera.longitude), imageWidth: metadata.width, imageHeight: metadata.height, discoveredAt: now.toISOString(), candidateScore: scoreCameraCandidate(camera,now) } };
        const quality = calculateCameraQuality(camera,now,await analyzeCameraQualityImage(image.buffer));
        camera = { ...camera, review: { quality, coverage: { strictSlotCount: 0, extendedSlotCount: 0, representativeDates: 12 } } };
      } catch(error) { probe.error = error instanceof Error ? error.message : "Image failed"; }
    } else probe.error = camera.enabled ? "No permitted still image" : "Inactive or source rights unverified";
    results.push(camera); probes.push(probe);
    if (results.length%50===0 || results.length===cameras.length) {
      await writeFile(`data/providers/${id}-reviewed.json`, JSON.stringify(results,null,2)+"\n");
      await writeFile(`data/providers/${id}-benchmark.json`,JSON.stringify({ provider:id,startedAt,completed:results.length===cameras.length,generatedAt:new Date().toISOString(),...benchmarkSummary(results,probes),probes },null,2)+"\n");
      console.log(`${id}: ${results.length}/${cameras.length}, reachable=${probes.filter((p)=>p.reachable).length}, fresh=${probes.filter((p)=>p.fresh).length}`);
    }
  }
}
async function main() {
  await mkdir("data/providers",{recursive:true});
  const requested=process.argv[2]; if(requested && !OFFICIAL_PROVIDER_IDS.includes(requested as OfficialProviderId)) throw new Error("Unknown provider");
  const ids=requested?[requested as OfficialProviderId]:OFFICIAL_PROVIDER_IDS;
  const results=await Promise.allSettled(ids.map(benchmark));
  results.forEach((result,i)=>{if(result.status==="rejected") { console.error(ids[i],result.reason);process.exitCode=1; }});
}
void main().catch((error)=>{console.error(error);process.exitCode=1;});
