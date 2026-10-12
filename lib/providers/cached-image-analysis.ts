import { analyzeImageBuffer } from "@/lib/image-viability";
import { analyzeSunsetImage, type CandidateImageAnalysis } from "@/lib/image-score";
import type { SolarImageContext } from "@/lib/sunset-evidence";
import type { ReviewedProvider } from "@/types/provider-review";
import { fetchProviderImage } from "./image-cache";

// Reuse byte validators and fingerprints without changing the scoring functions.
// Solar context affects evidence: a changed phase/context must be rescored.
export function createCachedProviderAnalysis(
  fetchImage = fetchProviderImage, analyzeVisual = analyzeSunsetImage, analyzeViability = analyzeImageBuffer,
) {
  const viability = new Map<string, ReturnType<typeof analyzeImageBuffer>>();
  const scores = new Map<string, Promise<CandidateImageAnalysis>>();
  const captureTimes = new Map<string, string>();
  return async (source: ReviewedProvider, url: string, phase: number, context: SolarImageContext, imageTimestamp?: string): Promise<CandidateImageAnalysis> => {
    const imageKey = `${source}:${url}`;
    // A new capture must revalidate bytes even inside TTL. A 304 still reuses them.
    const image = await fetchImage(source, url, imageTimestamp !== undefined && captureTimes.get(imageKey) !== imageTimestamp);
    if (imageTimestamp !== undefined) captureTimes.set(imageKey, imageTimestamp);
    while (captureTimes.size > 96) captureTimes.delete(captureTimes.keys().next().value!);
    const key = JSON.stringify([image.fingerprint, phase, context.isSunSetting, context.solarElevation,
      context.solarAzimuth, context.cameraAzimuth, context.horizontalFieldOfView]);
    if (!scores.has(key)) {
      if (!viability.has(image.fingerprint)) {
        const check = analyzeViability(image.buffer);
        viability.set(image.fingerprint, check);
        void check.catch(() => viability.delete(image.fingerprint));
      }
      const work = Promise.all([viability.get(image.fingerprint)!, analyzeVisual(image.buffer, phase, context)])
        .then(([checked, visual]) => ({ viability: checked, visual }));
      scores.set(key, work);
      void work.catch(() => scores.delete(key));
      while (scores.size > 192) scores.delete(scores.keys().next().value!);
      while (viability.size > 96) viability.delete(viability.keys().next().value!);
    }
    return structuredClone(await scores.get(key)!);
  };
}
const runtime = globalThis as typeof globalThis & { reviewedImageAnalysis?: ReturnType<typeof createCachedProviderAnalysis> };
export const fetchReviewedProviderAnalysis = runtime.reviewedImageAnalysis ??= createCachedProviderAnalysis();
