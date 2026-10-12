import { createHash } from "node:crypto";
import { PROVIDERS } from "./catalogue";
import { getProviderHttpStats, providerFetch } from "./http-cache";
import { timestamp } from "./normalize";
import type { CameraSource } from "@/types/camera";
export interface CachedImage { buffer: Buffer; fingerprint: string; timestamp?: string; etag?: string; modified?: string; checkedAt: number }
export function createProviderImageCache(fetcher: typeof fetch = fetch, now = Date.now, maximumEntries = 96) {
  const cache = new Map<string, CachedImage>(); const pending = new Map<string, Promise<CachedImage>>();
  return async (source: CameraSource, url: string, forceRevalidate = false): Promise<CachedImage> => {
    if (source === "digitraffic" || source === "usgs") {
      const parsed = new URL(url);
      const host = source === "digitraffic" ? "weathercam.digitraffic.fi" : "volcview.wr.usgs.gov";
      if (parsed.protocol !== "https:" || parsed.hostname !== host || parsed.username || parsed.password)
        throw new Error("Reviewed provider image URL outside approved official host");
    }
    const key = `${source}:${url}`; const existing = cache.get(key);
    if (existing && !forceRevalidate && now() - existing.checkedAt < PROVIDERS[source].imageTtlMs) { getProviderHttpStats(source).cacheHits += 1; return existing; }
    if (pending.has(key)) return pending.get(key)!;
    const operation = (async () => {
      const headers: Record<string, string> = {};
      if (existing?.etag) headers["If-None-Match"] = existing.etag;
      else if (existing?.modified) headers["If-Modified-Since"] = existing.modified;
      const response = await providerFetch(source, url, { headers, ...((source === "digitraffic" || source === "usgs") ? { redirect: "error" as const } : {}) }, fetcher);
      if (response.status === 304) {
        if (!existing) throw new Error("Image returned 304 without cached bytes");
        existing.checkedAt = now(); return existing;
      }
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`${source} did not return an image`);
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 8 * 1024 * 1024) throw new Error("Camera image exceeds 8 MB limit");
      const reader = response.body?.getReader(); if (!reader) throw new Error("Empty image response");
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.length;
        if (total > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("Camera image exceeds 8 MB limit"); }
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks); const modified = response.headers.get("last-modified") ?? undefined;
      const image: CachedImage = { buffer, fingerprint: createHash("sha256").update(buffer).digest("hex"), checkedAt: now(), modified,
        timestamp: PROVIDERS[source].timestampFromImageHeaders ? timestamp(modified) : undefined, etag: response.headers.get("etag") ?? undefined };
      cache.delete(key); cache.set(key, image);
      while (cache.size > maximumEntries) cache.delete(cache.keys().next().value!);
      return image;
    })().finally(() => pending.delete(key));
    pending.set(key, operation); return operation;
  };
}
const runtime = globalThis as typeof globalThis & { officialImageCache?: ReturnType<typeof createProviderImageCache> };
export const fetchProviderImage = runtime.officialImageCache ??= createProviderImageCache();
