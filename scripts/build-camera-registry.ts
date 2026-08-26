import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCameraCapabilityStats } from "../lib/camera-capabilities";
import { calculateCameraQuality, fetchCameraQualityImage } from "../lib/camera-quality";
import { buildCoverageMatrix, getCoverageCounts, getCoverageStatistics, optimizeRegistry } from "../lib/coverage-optimizer";
import { COVERAGE_REGISTRY_SIZES, MIN_CAMERA_QUALITY, TARGET_GOLD_CAMERA_COUNT, TARGET_STRICT_COVERAGE } from "../lib/config";
import { getCameraDirection } from "../lib/camera-direction";
import type { Camera, CameraImageQuality } from "../types/camera";

const root = process.cwd(); const dataDirectory = path.join(root, "data");
const candidatesPath = path.join(dataDirectory, "camera-candidates.json");
const reviewedPath = path.join(dataDirectory, "cameras-reviewed.json");
const goldPath = path.join(dataDirectory, "cameras.json");
const reportPath = path.join(dataDirectory, "coverage-report.json");
const skipImages = process.argv.includes("--skip-images");
const requestedSize = Number(process.argv.find((argument) => argument.startsWith("--size="))?.split("=")[1]);
const goldTarget = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : TARGET_GOLD_CAMERA_COUNT;

async function readCameras(file: string): Promise<Camera[]> {
  try { return JSON.parse(await readFile(file, "utf8")) as Camera[]; } catch { return []; }
}

const overrideFields = ["enabled", "qualityWeight", "manualQualityOverride", "manualViewAzimuth", "manualDirectionConfidence", "notes", "permanentlyRejected"] as const;
function applyOverrides(camera: Camera, sources: Array<Camera | undefined>): Camera {
  const output = { ...camera };
  for (const source of sources) for (const field of overrideFields) if (source && source[field] !== undefined) Object.assign(output, { [field]: source[field] });
  return output;
}

async function reviewQuality(cameras: Camera[], existing: Map<string, Camera>): Promise<Camera[]> {
  const reviewed: Camera[] = new Array(cameras.length); let nextIndex = 0; let completed = 0;
  async function worker() {
    while (nextIndex < cameras.length) {
      const index = nextIndex; nextIndex += 1; const camera = cameras[index]; const cached = existing.get(camera.id)?.review?.quality;
      let image: CameraImageQuality | undefined;
      const sameImage = cached?.imageTimestamp && cached.imageTimestamp === (camera.lastKnownImageTimestamp ?? camera.imageUpdatedAt);
      if (sameImage && cached.image?.status === "analyzed") image = cached.image;
      else if (!skipImages && camera.lastKnownImageUrl) image = await fetchCameraQualityImage(camera.lastKnownImageUrl);
      const quality = calculateCameraQuality(camera, new Date(), image);
      reviewed[index] = { ...camera, directionConfidence: getCameraDirection(camera).confidence, review: { quality, coverage: { strictSlotCount: 0, extendedSlotCount: 0, representativeDates: 12 } } };
      completed += 1; if (completed % 100 === 0 || completed === cameras.length) console.log(`Quality review: ${completed}/${cameras.length}`);
    }
  }
  await Promise.all(Array.from({ length: 12 }, () => worker()));
  return reviewed;
}

function numericStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b); const percentile = (value: number) => sorted[Math.floor((sorted.length - 1) * value)] ?? 0;
  return { minimum: sorted[0] ?? 0, average: Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) * 100) / 100, median: percentile(0.5), percentile5: percentile(0.05), maximum: sorted.at(-1) ?? 0 };
}

async function main() {
  const [rawCandidates, oldReviewed, oldGold] = await Promise.all([readCameras(candidatesPath), readCameras(reviewedPath), readCameras(goldPath)]);
  if (rawCandidates.length === 0) throw new Error("camera-candidates.json is empty. Run npm run discover-cameras first.");
  const reviewedById = new Map(oldReviewed.map((camera) => [camera.id, camera])); const goldById = new Map(oldGold.map((camera) => [camera.id, camera]));
  const candidates = rawCandidates.map((camera) => applyOverrides(camera, [reviewedById.get(camera.id), goldById.get(camera.id)]));
  const reviewed = await reviewQuality(candidates, reviewedById);
  console.log("Building offline solar coverage matrix...");
  const matrix = buildCoverageMatrix(reviewed);
  reviewed.forEach((camera) => {
    const coverage = matrix.byCamera.get(camera.id)!;
    camera.review!.coverage = { strictSlotCount: coverage.strictSlots.length, extendedSlotCount: coverage.extendedSlots.length, representativeDates: 12 };
  });
  const maximumSize = Math.max(...COVERAGE_REGISTRY_SIZES, goldTarget);
  const ordered = optimizeRegistry(reviewed, matrix, maximumSize);
  const comparisons = COVERAGE_REGISTRY_SIZES.map((size) => getCoverageStatistics(ordered.slice(0, size).map((camera) => camera.id), matrix));
  const satisfactory = comparisons.find((stats) => stats.percentile5Strict >= TARGET_STRICT_COVERAGE && stats.slotsBelowStrictTarget <= matrix.slots.length * 0.05);
  const recommendedSize = satisfactory?.cameraCount ?? comparisons.reduce((best, current) => current.slotsBelowStrictTarget < best.slotsBelowStrictTarget ? current : best).cameraCount;
  const gold = ordered.slice(0, goldTarget);
  const orderedById = new Map(ordered.map((camera) => [camera.id, camera]));
  const reviewedOutput = reviewed.map((camera) => orderedById.get(camera.id) ?? camera);
  const goldCounts = getCoverageCounts(gold.map((camera) => camera.id), matrix);
  const goldIds = new Set(gold.map((camera) => camera.id));
  const worstSlots = matrix.slots.map((slot) => ({
    ...slot, strict: goldCounts.strict[slot.index], total: goldCounts.total[slot.index],
    suggestions: reviewed.filter((camera) => !goldIds.has(camera.id) && (camera.review?.quality.score ?? 0) >= MIN_CAMERA_QUALITY && matrix.byCamera.get(camera.id)?.extendedSlots.includes(slot.index)).sort((a, b) => (b.review?.quality.score ?? 0) - (a.review?.quality.score ?? 0)).slice(0, 5).map((camera) => ({ id: camera.id, name: camera.name, quality: camera.review!.quality.score })),
  })).sort((a, b) => a.strict - b.strict || a.total - b.total).slice(0, 20);
  const qualityValues = reviewed.map((camera) => camera.review!.quality.score);
  const candidateCapabilities = getCameraCapabilityStats(reviewed);
  const goldCapabilities = getCameraCapabilityStats(gold);
  const report = {
    generatedAt: new Date().toISOString(), candidateCount: reviewed.length, goldCount: gold.length,
    countries: new Set(gold.map((camera) => camera.country).filter(Boolean)).size,
    knownDirections: gold.filter((camera) => getCameraDirection(camera).viewAzimuth !== undefined).length,
    unknownDirections: gold.filter((camera) => getCameraDirection(camera).viewAzimuth === undefined).length,
    quality: { ...numericStats(qualityValues), eligibleCount: reviewed.filter((camera) => !camera.permanentlyRejected && camera.enabled && camera.review!.quality.score >= MIN_CAMERA_QUALITY).length, minimumRequired: MIN_CAMERA_QUALITY },
    goldQuality: numericStats(gold.map((camera) => camera.review!.quality.score)),
    imageAnalysis: { analyzed: reviewed.filter((camera) => camera.review?.quality.image?.status === "analyzed").length, unavailable: reviewed.filter((camera) => camera.review?.quality.image?.status === "unavailable").length },
    capabilities: { candidates: candidateCapabilities, gold: goldCapabilities },
    registryComparisons: comparisons, recommendedSize, worstSlots,
    heatmap: matrix.slots.map((slot) => ({ dateLabel: slot.dateLabel, utcTime: slot.utcTime, strict: goldCounts.strict[slot.index], total: goldCounts.total[slot.index] })),
  };
  await Promise.all([
    writeFile(reviewedPath, `${JSON.stringify(reviewedOutput, null, 2)}\n`, "utf8"),
    writeFile(goldPath, `${JSON.stringify(gold, null, 2)}\n`, "utf8"),
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({
    candidateCount: report.candidateCount,
    candidateProviderUrls: candidateCapabilities.withProviderUrl,
    candidateLivePlayers: candidateCapabilities.withLivePlayer,
    candidateSnapshotOnly: candidateCapabilities.snapshotOnly,
    goldCount: report.goldCount,
    goldProviderUrls: goldCapabilities.withProviderUrl,
    goldLivePlayers: goldCapabilities.withLivePlayer,
    goldSnapshotOnly: goldCapabilities.snapshotOnly,
    quality: report.quality, comparisons, recommendedSize, worstSlots: worstSlots.slice(0, 5),
  }, null, 2));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
