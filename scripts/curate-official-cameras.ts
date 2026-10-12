import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { PROVIDERS } from "../lib/providers/catalogue";
import { createFeedCache } from "../lib/providers/http-cache";
import { FEED_URLS } from "../lib/providers/official-webcam-provider";
import { normalizeDigitraffic, normalizeUsgs } from "../lib/providers/official-normalizers";
import { record, array, string, number, url } from "../lib/providers/normalize";
import { fetchProviderImage } from "../lib/providers/image-cache";
import { analyzeCameraQualityImage, calculateCameraQuality } from "../lib/camera-quality";
import { analyzeImageBuffer } from "../lib/image-viability";
import { estimateSkyGeometry } from "../lib/sky-geometry";
import { getSolarElevation } from "../lib/solar";
import { getLongitudeBucket, scoreCameraCandidate } from "../lib/camera-discovery";
import type { Camera } from "../types/camera";
import type { ProviderCameraReview, ProviderReviewFile, ReviewedProvider } from "../types/provider-review";

// Bounded metadata-guided sample; NEVER promotes candidates into runtime itself.
const stationIds = ["C14535", "C14516", "C14544", "C10506", "C02526", "C12531", "C03518",
  "C06521", "C08587", "C14578", "C14594", "C14533", "C14585", "C14582", "C14525",
  "C12509", "C12550", "C12601", "C14508", "C02590"];
const allowedHosts: Record<ReviewedProvider, string[]> = {
  usgs: ["volcview.wr.usgs.gov"], digitraffic: ["weathercam.digitraffic.fi"],
};

async function main() {
  const requested = process.argv[2];
  if (requested !== "usgs" && requested !== "digitraffic") throw new Error("Use usgs or digitraffic only");
  const provider: ReviewedProvider = requested;
  const output = process.argv.find(a => a.startsWith("--output="))?.slice(9);
  if (!output?.startsWith(`data/providers/${provider}-review-`)) throw new Error("Use a NEW data/providers/<provider>-review-<run>.json output");
  try { await readFile(output); throw new Error("Review output exists; refusing to overwrite"); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const snapshotDirectory = process.argv.find(a => a.startsWith("--metadata-directory="))?.slice(21);
  const snapshot = async (name: string, url: string): Promise<unknown> => {
    if (snapshotDirectory) {
      const raw = JSON.parse(await readFile(path.join(snapshotDirectory, `${name}.json`), "utf8"));
      return raw;
    }
    return createFeedCache(provider, url, JSON.parse).load();
  };
  const selected: Array<{ id: string; camera: Camera | null; reason?: string }> = [];
  if (provider === "usgs") {
    const raw = await snapshot("usgs", FEED_URLS.usgs);
    const normalized = new Map(normalizeUsgs(raw).map(c => [c.id, c]));
    // Include the previously examined HVO placeholders and verified USGS-hosted
    // source records, but do not infer ownership of other aggregated cameras.
    for (const item of array(record(raw).webcams)) {
      const r = record(item); const code = string(r.webcamCode); if (!code) continue;
      const external = url(r.externalUrl);
      const own = external ? new URL(external).hostname.endsWith(".usgs.gov") : false;
      if (!own && !/^(kilauea|mauna-loa)-/.test(code)) continue;
      if (selected.length >= 40) break;
      const id = `usgs:${code}`; const camera = normalized.get(id) ?? null;
      selected.push({ id, camera, reason: number(r.latitude) === 0 && number(r.longitude) === 0 ? "Ashcam supplies (0,0); no camera-coordinate fallback available" : undefined });
    }
  } else {
    const [raw, times] = await Promise.all([snapshot("digitraffic", FEED_URLS.digitraffic), snapshot("digitraffic-times", FEED_URLS.digitrafficData)]);
    const details: unknown[] = [];
    for (const id of stationIds) {
      let detail: unknown;
      try {
        detail = snapshotDirectory ? JSON.parse(await readFile(path.join(snapshotDirectory, `${id}.json`), "utf8")) : undefined;
      } catch { /* Fetch missing station details below, using the existing cache. */ }
      if (!detail) detail = await createFeedCache(provider, `${FEED_URLS.digitraffic}/${id}`, JSON.parse, 24 * 3600_000).load();
      details.push(detail);
    }
    const detailed = normalizeDigitraffic(raw, times, details);
    for (const id of stationIds) {
      const cameras = detailed.filter(c => c.providerCameraId?.startsWith(id) && c.enabled
        && !/Tienpinta|road surface/i.test(c.viewDescription ?? ""));
      // Landscape/extra presets first; road chainage is never treated as azimuth.
      cameras.sort((a, b) => Number(/Maisema|tunturi|maisem/i.test(b.viewDescription ?? "")) - Number(/Maisema|tunturi|maisem/i.test(a.viewDescription ?? ""))
        || Number(/[78]$/.test(b.providerCameraId ?? "")) - Number(/[78]$/.test(a.providerCameraId ?? "")) || a.id.localeCompare(b.id));
      for (const camera of cameras.slice(0, 2)) selected.push({ id: camera.id, camera });
    }
  }
  const previewDirectory = await mkdtemp(path.join(tmpdir(), `eternal-3.7b-${provider}-`));
  const rows: ProviderCameraReview[] = [];
  const thumbnails: Buffer[] = [];
  let imageRequests = 0;
  for (const item of selected.slice(0, 40)) {
    const camera = item.camera;
    const row: ProviderCameraReview = { id: item.id, camera, status: "pending-manual-review", reason: "Needs manual horizon/composition review",
      imageAttempted: false, imageDecoded: false, fresh: false, daylightValidated: false, horizonVerified: false };
    if (!camera) { row.status = "rejected-no-coordinates"; row.reason = item.reason ?? "Missing/invalid official camera coordinates"; }
    else if (!camera.imageUrl) { row.status = "rejected-no-image"; row.reason = "No official still image"; }
    // https://www.usgs.gov/volcanoes/kilauea/webcams identifies F1 as thermal.
    else if (provider === "usgs" && camera.id === "usgs:kilauea-f1-cam") { row.status = "rejected-poor-horizon"; row.reason = "Official HVO F1 is thermal imagery, unsuitable for visible-light sunset scoring"; }
    else if (!camera.enabled || camera.supportsVisualScoring === false) { row.status = "rejected-rights-unverified"; row.reason = "Image unavailable or source ownership unverified"; }
    else {
      const now = new Date();
      row.ageMinutes = camera.imageUpdatedAt ? (now.getTime() - Date.parse(camera.imageUpdatedAt)) / 60_000 : undefined;
      row.fresh = row.ageMinutes !== undefined && row.ageMinutes >= -5 && row.ageMinutes <= PROVIDERS[provider].maximumImageAgeMinutes;
      row.solarElevation = getSolarElevation(row.fresh ? new Date(camera.imageUpdatedAt!) : now, camera.latitude, camera.longitude);
      if (!row.fresh) { row.status = "rejected-stale"; row.reason = "Capture timestamp unavailable, future or older than provider limit"; }
      else if (row.solarElevation < 3) { row.status = "rejected-night-only/insufficient-validation"; row.reason = "Daylight qualification requires solar elevation >=3 degrees; no night frame downloaded"; }
      else {
        try {
          const url = new URL(camera.imageUrl);
          if (url.protocol !== "https:" || !allowedHosts[provider].includes(url.hostname)) throw new Error("Image URL outside approved official hosts");
          row.imageAttempted = true; imageRequests++;
          const image = await fetchProviderImage(provider, camera.imageUrl);
          const metadata = await sharp(image.buffer, { limitInputPixels: 25_000_000 }).metadata();
          const qualityImage = await analyzeCameraQualityImage(image.buffer);
          const viability = await analyzeImageBuffer(image.buffer);
          const { data, info } = await sharp(image.buffer).resize(256, 144, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const sky = estimateSkyGeometry(data, info.width, info.height, info.channels);
          row.normalizedSkyArea = sky.boundary.reduce((sum, y) => sum + y, 0) / (info.width * info.height);
          row.horizonConfidence = sky.confidence;
          row.imageDecoded = true; row.daylightValidated = viability.status === "viable" && viability.viable;
          row.imageFingerprint = image.fingerprint;
          camera.lastKnownImageUrl = camera.imageUrl; camera.lastKnownImageTimestamp = camera.imageUpdatedAt;
          camera.discovery = { longitudeBucket: getLongitudeBucket(camera.longitude), imageWidth: metadata.width, imageHeight: metadata.height,
            discoveredAt: now.toISOString(), candidateScore: scoreCameraCandidate(camera, now) };
          camera.review = { quality: calculateCameraQuality(camera, now, qualityImage), coverage: { strictSlotCount: 0, extendedSlotCount: 0, representativeDates: 0 } };
          if (!row.daylightValidated) { row.status = "rejected-poor-horizon"; row.reason = viability.reason ?? "Image not viable"; }
          const thumbnail = await sharp(image.buffer).resize(320, 180, { fit: "contain", background: "#151515" }).png().toBuffer();
          thumbnails.push(thumbnail);
          await writeFile(path.join(previewDirectory, `${item.id.replaceAll(":", "-")}.png`), thumbnail, { flag: "wx" });
        } catch (error) { row.status = "rejected-no-image"; row.reason = error instanceof Error ? error.message : "Image failed"; }
      }
    }
    rows.push(row);
    console.log(`${provider} ${rows.length}/${Math.min(selected.length, 40)} ${row.id} ${row.status} quality=${camera?.review?.quality.score ?? "N/A"}`);
  }
  for (let start = 0; start < thumbnails.length; start += 12) {
    const batch = thumbnails.slice(start, start + 12);
    await sharp({ create: { width: 960, height: Math.ceil(batch.length / 3) * 180, channels: 3, background: "#151515" } })
      .composite(batch.map((input, i) => ({ input, left: i % 3 * 320, top: Math.floor(i / 3) * 180 })))
      .png().toFile(path.join(previewDirectory, `sheet-${start / 12 + 1}.png`));
  }
  const artifact: ProviderReviewFile = { provider, generatedAt: new Date().toISOString(), sampleLimit: 40, imageRequests, rows };
  await writeFile(output, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx" });
  console.log(`Review: ${output}; previews: ${previewDirectory}`);
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Curation failed"); process.exitCode = 1; });
