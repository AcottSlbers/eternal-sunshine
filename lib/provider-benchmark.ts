import type { Camera } from "@/types/camera";
import { getCameraDirection } from "./camera-direction";
import { MIN_CAMERA_QUALITY } from "./config";
import { PROVIDERS } from "./providers/catalogue";
export interface CameraProbe { cameraId: string; attempted: boolean; reachable: boolean; fresh: boolean; width?: number; height?: number; etag: boolean; timestampKnown: boolean; error?: string }
export function quantiles(values: number[]) {
  const sorted = [...values].sort((a,b) => a-b); const q = (p: number) => sorted.length ? sorted[Math.floor((sorted.length-1)*p)] : null;
  return { p10: q(.1), p50: q(.5), p90: q(.9), average: sorted.length ? Math.round(sorted.reduce((a,b)=>a+b,0)/sorted.length*10)/10 : null };
}
export function benchmarkSummary(cameras: Camera[], probes: CameraProbe[]) {
  const attempted = probes.filter((p)=>p.attempted); const reachable = probes.filter((p)=>p.reachable); const source = cameras[0]?.source;
  const scores = cameras.filter((c)=>c.review?.quality.image?.status === "analyzed").map((c)=>c.review!.quality.score);
  const count = (key: "fresh" | "timestampKnown" | "etag") => reachable.filter((p)=>p[key]).length;
  const pct = (n: number, d: number) => d ? Math.round(n/d*1000)/10 : null;
  const directionKnown = cameras.filter((c)=>getCameraDirection(c).viewAzimuth !== undefined).length;
  const freshIds = new Set(probes.filter((p)=>p.fresh).map((p)=>p.cameraId));
  const qualified = cameras.filter((c)=>c.enabled && c.supportsVisualScoring !== false && freshIds.has(c.id) && c.review?.quality.image?.status === "analyzed" && c.review.quality.score >= MIN_CAMERA_QUALITY);
  const reliabilityParts = { imageSuccess: pct(reachable.length,attempted.length), freshness: pct(count("fresh"),attempted.length), timestampQuality: pct(count("timestampKnown"),attempted.length), cacheability: pct(count("etag"),attempted.length), direction: pct(directionKnown,cameras.length), licensingClarity: source && PROVIDERS[source].licenseVerified ? 100 : 0 };
  const metrics = Object.values(reliabilityParts).filter((v):v is number=>v!==null);
  return { cameras: cameras.length, attempted: attempted.length, reachable: reachable.length, reachablePercent: pct(reachable.length,attempted.length), fresh: count("fresh"), freshPercent: pct(count("fresh"),attempted.length), timestampKnown: count("timestampKnown"), knownDirection: directionKnown, knownDirectionPercent: pct(directionKnown,cameras.length),
    resolutionWidth: quantiles(reachable.flatMap((p)=>p.width?[p.width]:[])), resolutionHeight: quantiles(reachable.flatMap((p)=>p.height?[p.height]:[])), quality: quantiles(scores), qualityAboveMinimum: cameras.filter((c)=>c.review?.quality.image?.status === "analyzed" && c.review.quality.score>=MIN_CAMERA_QUALITY).length,
    qualified: qualified.length, goodSky: cameras.filter((c)=>(c.review?.quality.image?.skyShare??0)>=.4).length, strongHorizon: cameras.filter((c)=>(c.review?.quality.image?.openComposition??0)>=.65 && (c.review?.quality.image?.skyShare??0)>=.4).length,
    providerReliability: Math.round(metrics.reduce((a,b)=>a+b,0)/Math.max(1,metrics.length)), reliabilityParts, eligibleIds: qualified.map((c)=>c.id) };
}
