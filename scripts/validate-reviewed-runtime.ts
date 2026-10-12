import { readFile, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { getSolarPosition, getSolarTrend, getSunsetCandidates, getSunsetPhaseScore } from "../lib/solar";
import { getProviderHttpStats } from "../lib/providers/http-cache";
import { OfficialWebcamProvider } from "../lib/providers/official-webcam-provider";
import { fetchProviderImage } from "../lib/providers/image-cache";
import { fetchReviewedProviderAnalysis } from "../lib/providers/cached-image-analysis";
import sharp from "sharp";

async function main() {
  const output = process.argv.find(a => a.startsWith("--output="))?.slice(9);
  if (!output?.startsWith("docs/phase-3.7b-runtime-")) throw new Error("Use a NEW docs/phase-3.7b-runtime-*.json output");
  try { await readFile(output); throw new Error("Output exists; refusing to overwrite"); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  config({ path: ".env.local", quiet: true });
  const { cameraRegistry } = await import("../lib/camera-registry");
  const { createRanking } = await import("../lib/ranking");
  const { createHeroSelector } = await import("../lib/public-ranking");
  const { toPublicRanking } = await import("../lib/public-response");
  const now = new Date();
  const candidates = getSunsetCandidates(cameraRegistry, now, "extended");
  if (candidates.length > 50) throw new Error(`Refusing live runtime run: ${candidates.length} astronomical cameras exceed cap of 50`);
  const probes = [];
  if (process.argv.includes("--probe-reviewed")) {
    for (const source of ["usgs", "digitraffic"] as const) {
      const ids = cameraRegistry.filter(c => c.source === source).slice(0, 2).map(c => c.id);
      if (!ids.length) continue;
      const provider = new OfficialWebcamProvider(source);
      for (const camera of await provider.getCameras(ids)) {
        const position = getSolarPosition(now, camera.latitude, camera.longitude);
        const trend = getSolarTrend(now, camera.latitude, camera.longitude);
        const imageUrl = camera.previewImageUrl ?? camera.imageUrl;
        if (!imageUrl) continue;
        const context = { isSunSetting: trend.isSunSetting, solarElevation: position.elevation,
          solarAzimuth: position.azimuth, cameraAzimuth: camera.viewAzimuth };
        const phase = getSunsetPhaseScore(position.elevation);
        const first = await fetchReviewedProviderAnalysis(source, imageUrl, phase, context, camera.imageUpdatedAt);
        const before = { ...getProviderHttpStats(source) };
        const repeated = await fetchReviewedProviderAnalysis(source, imageUrl, phase, context, camera.imageUpdatedAt);
        const after = { ...getProviderHttpStats(source) };
        const image = await fetchProviderImage(source, imageUrl);
        const metadata = await sharp(image.buffer, { limitInputPixels: 25_000_000 }).metadata();
        probes.push({ id: camera.id, source, timestamp: camera.imageUpdatedAt,
          ageMinutes: camera.imageUpdatedAt ? (now.getTime() - Date.parse(camera.imageUpdatedAt)) / 60_000 : null,
          solarElevation: position.elevation, enabled: camera.enabled, directionConfidence: camera.directionConfidence,
          decoded: true, resolution: `${metadata.width}x${metadata.height}`, imageFingerprint: image.fingerprint,
          scoreStatus: first.visual.status, evidence: first.visual.sunsetEvidenceScore, beauty: first.visual.sunsetBeautyScore,
          repeatedResultsEqual: JSON.stringify(first) === JSON.stringify(repeated),
          repeatedHttpRequests: after.requests - before.requests, repeatedImageCacheHits: after.cacheHits - before.cacheHits,
          attribution: camera.attribution, context: "Current daylight/off-window probe; not injected into ranking" });
      }
    }
  }
  const result = await createRanking(now, createHeroSelector());
  const publicResult = toPublicRanking(result);
  const sources = ["windy", "meteogalicia", "usgs", "digitraffic"] as const;
  const counts = Object.fromEntries(sources.map(source => [source, cameraRegistry.filter(c => c.source === source).length]));
  const artifact = { generatedAt: now.toISOString(), candidateCap: 50, probes, registryCounts: counts, diagnostics: result.diagnostics,
    providerDiagnostics: result.providerDiagnostics,
    candidates: result.candidateDiagnostics.map(d => ({ id: d.camera.id, source: d.camera.source, stage: d.stage,
      solarElevation: d.solarElevation, visibility: d.visibility, reason: d.reason, imageChecked: d.imageChecked,
      imageAnalyzed: d.imageAnalyzed, imageAgeMinutes: d.scored?.imageAgeMinutes })),
    publicCameraIds: publicResult.results.map(r => r.camera.id), heroId: publicResult.rankedHero?.camera.id ?? null,
    officialHttp: Object.fromEntries((["usgs", "digitraffic"] as const).map(source => [source, getProviderHttpStats(source)])),
  };
  await writeFile(output, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ registryCounts: counts, diagnostics: result.diagnostics, providers: result.providerDiagnostics, publicCameraIds: artifact.publicCameraIds }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Runtime validation failed"); process.exitCode = 1; });
