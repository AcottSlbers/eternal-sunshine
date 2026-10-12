import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { PROVIDERS } from "../lib/providers/catalogue";
import { createOfficialLoader, OfficialWebcamProvider } from "../lib/providers/official-webcam-provider";
import { createProviderImageCache } from "../lib/providers/image-cache";
import { analyzeCameraQualityImage, calculateCameraQuality } from "../lib/camera-quality";
import { analyzeImageBuffer } from "../lib/image-viability";
import { getCameraDirection } from "../lib/camera-direction";
import { getLongitudeBucket, scoreCameraCandidate } from "../lib/camera-discovery";
import { cameraDistanceKm } from "../lib/public-ranking";
import { buildCoverageMatrix, getCoverageCounts } from "../lib/coverage-optimizer";
import { cameraRegistry } from "../lib/camera-registry";
import type { Camera } from "../types/camera";

// Validation only: no discovery, registry writes, credentials, or sunset scoring.
// Terms reviewed for this run are recorded in the companion Markdown report.
const permitted = ["digitraffic", "nsw", "usgs"] as const;
type SampleProvider = typeof permitted[number];
const hosts: Record<SampleProvider, string[]> = {
  digitraffic: ["tie.digitraffic.fi", "weathercam.digitraffic.fi"],
  nsw: ["data.livetraffic.com", "webcams.transport.nsw.gov.au"],
  usgs: ["volcview.wr.usgs.gov"],
};
// These visible-light HVO cameras are identified on official USGS webcam pages.
// Do not rely solely on the normalizer's ownership prefix heuristic.
const usgsIds = new Set(["kilauea-ko-cam", "kilauea-hp-cam", "kilauea-kw-cam",
  "kilauea-s1-cam", "kilauea-s2-cam", "kilauea-b1-cam", "kilauea-k2-cam",
  "kilauea-kp-cam", "kilauea-mitd-cam", "mauna-loa-ml-cam"].map(id => `usgs:${id}`));

function selectSample(cameras: Camera[]): Camera[] {
  const available = [...new Map(cameras.filter(c => c.enabled && c.supportsVisualScoring !== false && c.imageUrl).map(c => [c.id, c])).values()];
  const chosen: Camera[] = [];
  while (chosen.length < 10 && available.length) {
    available.sort((a, b) => {
      const diversity = (c: Camera) => {
        const distance = chosen.length ? Math.min(...chosen.map(other => cameraDistanceKm(c, other))) : 0;
        const direction = getCameraDirection(c).viewAzimuth;
        const directionNew = !chosen.some(other => getCameraDirection(other).viewAzimuth === direction);
        const regionNew = !chosen.some(other => other.region === c.region);
        return distance + (directionNew ? 40 : 0) + (regionNew ? 40 : 0);
      };
      return diversity(b) - diversity(a) || a.id.localeCompare(b.id);
    });
    chosen.push(available.shift()!);
  }
  return chosen;
}

async function validate(id: SampleProvider, previewDirectory: string) {
  if (!PROVIDERS[id].defaultEnabled) throw new Error(`${id} disabled by policy`);
  const saved = JSON.parse(await readFile(`data/providers/${id}-candidates.json`, "utf8")) as Camera[];
  const sample = selectSample(id === "usgs" ? saved.filter(c => usgsIds.has(c.id) && c.usagePolicy === "open-commercial") : saved);
  const requests: Array<{ host: string; kind: "metadata" | "image"; status?: number; error?: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== "https:" || !hosts[id].includes(url.hostname) || url.username || url.password) throw new Error("URL rejected by validation allowlist");
    const observation: typeof requests[number] = { host: url.hostname, kind: url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg") ? "image" : "metadata" };
    requests.push(observation);
    try {
      // Extra-conservative sampling pace; existing providerFetch also enforces policy.
      await new Promise(resolve => setTimeout(resolve, 1500));
      const response = await fetch(input, { ...init, redirect: "error" });
      observation.status = response.status;
      return response;
    } catch (error) {
      observation.error = error instanceof Error ? `${error.name}: ${error.message}` : "Fetch failed";
      throw error;
    }
  };
  const provider = new OfficialWebcamProvider(id, createOfficialLoader(id, fetcher));
  const images = createProviderImageCache(fetcher);
  let current: Camera[] = [];
  let metadataError: string | undefined;
  try { current = await provider.getCameras(sample.map(c => c.id)); }
  catch (error) { metadataError = error instanceof Error ? error.message : "Metadata failed"; }
  const currentById = new Map(current.map(c => [c.id, c]));
  const rows = [];
  const suitable: Camera[] = [];
  const previews: Buffer[] = [];
  for (const [index, original] of sample.entries()) {
    const camera = currentById.get(original.id);
    const direction = getCameraDirection(camera ?? original);
    const row = { id: original.id, name: original.name, latitude: original.latitude, longitude: original.longitude,
      direction: direction.viewAzimuth ?? null, directionConfidence: direction.confidence,
      attempted: false, decoded: false, timestamp: null as string | null, timestampSource: null as string | null,
      ageMinutes: null as number | null, fresh: false, width: null as number | null, height: null as number | null,
      cameraQualityScore: null as number | null, skyShare: null as number | null, openComposition: null as number | null,
      viable: false, suitabilityProxy: false, error: null as string | null };
    if (!camera?.enabled || !camera.imageUrl || camera.supportsVisualScoring === false) {
      row.error = metadataError ?? "Camera absent, inactive, or image scoring disallowed in refreshed metadata";
    } else {
      row.attempted = true;
      try {
        const image = await images(id, camera.imageUrl);
        const metadata = await sharp(image.buffer, { limitInputPixels: 25_000_000 }).metadata();
        const now = new Date();
        const updated = camera.imageUpdatedAt ?? image.timestamp;
        const age = updated ? (now.getTime() - Date.parse(updated)) / 60_000 : NaN;
        const imageQuality = await analyzeCameraQualityImage(image.buffer);
        const viability = await analyzeImageBuffer(image.buffer);
        const enriched: Camera = { ...camera, lastKnownImageTimestamp: updated, lastKnownImageUrl: camera.imageUrl,
          discovery: { longitudeBucket: getLongitudeBucket(camera.longitude), imageWidth: metadata.width,
            imageHeight: metadata.height, discoveredAt: now.toISOString(), candidateScore: scoreCameraCandidate(camera, now) } };
        const quality = calculateCameraQuality(enriched, now, imageQuality);
        Object.assign(row, { decoded: true, width: metadata.width, height: metadata.height,
          timestamp: updated ?? null, timestampSource: camera.imageUpdatedAt ? "refreshed-provider-metadata" : image.timestamp ? "http-last-modified (capture time unconfirmed)" : null,
          ageMinutes: Number.isFinite(age) ? Math.round(age * 10) / 10 : null,
          fresh: Number.isFinite(age) && age >= -5 && age <= PROVIDERS[id].maximumImageAgeMinutes,
          cameraQualityScore: quality.score, skyShare: imageQuality.skyShare, openComposition: imageQuality.openComposition,
          viable: viability.status === "viable" && viability.viable });
        row.suitabilityProxy = row.fresh && row.viable && quality.score >= 50 && imageQuality.skyShare >= .4 && imageQuality.openComposition >= .65;
        if (row.suitabilityProxy) suitable.push(enriched);
        const thumbnail = await sharp(image.buffer).resize(320, 180, { fit: "contain", background: "#151515" }).removeAlpha().png().toBuffer();
        previews.push(thumbnail);
        await writeFile(path.join(previewDirectory, `${id}-${index + 1}.png`), thumbnail, { flag: "wx" });
      } catch (error) { row.error = error instanceof Error ? error.message : "Image validation failed"; }
    }
    rows.push(row);
    console.log(`${id} ${index + 1}/${sample.length}: decoded=${row.decoded} fresh=${row.fresh} quality=${row.cameraQualityScore} ${row.error ?? ""}`);
  }
  if (previews.length) {
    await sharp({ create: { width: 640, height: Math.ceil(previews.length / 2) * 180, channels: 3, background: "#151515" } })
      .composite(previews.map((input, index) => ({ input, left: index % 2 * 320, top: Math.floor(index / 2) * 180 })))
      .png().toFile(path.join(previewDirectory, `${id}-contact-sheet.png`));
  }
  const baseline = [...new Map(cameraRegistry.filter(c => c.enabled).map(c => [c.id, c])).values()];
  const matrix = buildCoverageMatrix([...baseline, ...suitable]);
  const base = getCoverageCounts(baseline.map(c => c.id), matrix);
  const extra = getCoverageCounts(suitable.map(c => c.id), matrix);
  return { provider: id, discovered: saved.length, selected: sample.length, metadataReturned: current.length,
    metadataError: metadataError ?? null, requests, rows,
    preliminaryCoverage: { suitableProxyCount: suitable.length, slots: matrix.slots.length,
      strictSlotsWithAdditionalCamera: [...extra.strict].filter(n => n > 0).length,
      strictPreviouslyEmptySlotsFilled: [...base.strict].filter((n, i) => n === 0 && extra.strict[i] > 0).length,
      strictBelowEightSlotsImproved: [...base.strict].filter((n, i) => n < 8 && extra.strict[i] > 0).length,
      extendedPreviouslyEmptySlotsFilled: [...base.total].filter((n, i) => n === 0 && extra.total[i] > 0).length,
      locations: suitable.map(c => ({ id: c.id, nearestBaselineKm: Math.round(Math.min(...baseline.map(b => cameraDistanceKm(c, b)))) })) } };
}

async function main() {
  const output = "docs/phase-3.7a-provider-validation-results.json";
  try { await readFile(output); throw new Error("Validation output already exists; refusing to overwrite it"); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const startedAt = new Date().toISOString();
  const previewDirectory = await mkdtemp(path.join(tmpdir(), "eternal-sunshine-3.7a-"));
  const providers = [];
  for (const id of permitted) providers.push(await validate(id, previewDirectory));
  await writeFile(output, JSON.stringify({ startedAt, completedAt: new Date().toISOString(),
    sampleLimit: 10, previewDirectory, providers,
    blocked: { vegagerdin: "Camera reuse rights unclear", nzta: "Disabled by existing policy; no opt-in authorization",
      ontario511: "Current official documentation requires a registered API key; existing adapter lacks authentication" } }, null, 2) + "\n", { flag: "wx" });
  console.log(`Results: ${output}; temporary visual review: ${previewDirectory}`);
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Validation failed"); process.exitCode = 1; });
