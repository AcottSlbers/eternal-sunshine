import { PROVIDERS } from "@/lib/providers/catalogue";
import type { CameraSource } from "@/types/camera";

export interface HttpObservation { requests: number; successes: number; errors: number; notModified: number; cacheHits: number; lastSuccess?: number; lastError?: string }
const runtime = globalThis as typeof globalThis & { providerHttpStats?: Map<string, HttpObservation>; providerNextRequest?: Map<string, number> };
const stats = runtime.providerHttpStats ??= new Map();
const nextRequest = runtime.providerNextRequest ??= new Map();
export function getProviderHttpStats(id: string): HttpObservation {
  let value = stats.get(id);
  if (!value) { value = { requests: 0, successes: 0, errors: 0, notModified: 0, cacheHits: 0 }; stats.set(id, value); }
  return value;
}
export async function providerFetch(id: CameraSource, url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  const policy = PROVIDERS[id];
  const delay = Math.max(0, (nextRequest.get(id) ?? 0) - Date.now());
  nextRequest.set(id, Date.now() + delay + policy.minimumRequestGapMs);
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const observation = getProviderHttpStats(id); observation.requests += 1;
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept-Encoding", "gzip");
    if (id === "digitraffic") headers.set("Digitraffic-User", "EternalSunshine/local-hobby-0.3.7");
    const response = await fetcher(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15_000), cache: "no-store" });
    const manualRedirect = init.redirect === "manual" && response.status >= 300 && response.status < 400;
    if (!response.ok && response.status !== 304 && !manualRedirect) throw new Error(`${id} returned HTTP ${response.status}`);
    observation.successes += 1; observation.lastSuccess = Date.now();
    if (response.status === 304) observation.notModified += 1;
    return response;
  } catch (error) {
    observation.errors += 1; observation.lastError = error instanceof Error ? error.message : "Provider request failed";
    throw error;
  }
}

// Metadata cache: validators, shared in-flight work, bounded stale fallback and retry backoff.
export function createFeedCache<T>(id: CameraSource, url: string, parse: (body: string) => T, ttlMs = PROVIDERS[id].metadataTtlMs, fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: T | undefined; let fetchedAt = 0; let expires = 0; let retryAfter = 0;
  let etag: string | undefined; let modified: string | undefined; let pending: Promise<T> | undefined;
  return {
    ageMs: () => fetchedAt ? now() - fetchedAt : null,
    async load(): Promise<T> {
      if (cached !== undefined && now() < expires) { getProviderHttpStats(id).cacheHits += 1; return cached; }
      if (pending) return pending;
      if (now() < retryAfter) {
        if (cached !== undefined && now() - fetchedAt < ttlMs * 2) return cached;
        throw new Error(`${id} metadata retry backoff active`);
      }
      pending = (async () => {
        try {
          const headers: Record<string, string> = { Accept: "application/json, application/xml;q=0.8" };
          if (etag) headers["If-None-Match"] = etag;
          else if (modified) headers["If-Modified-Since"] = modified;
          const response = await providerFetch(id, url, { headers }, fetcher);
          if (response.status !== 304) {
            const parsed = parse(await response.text());
            cached = parsed; etag = response.headers.get("etag") ?? undefined; modified = response.headers.get("last-modified") ?? undefined;
          } else if (cached === undefined) throw new Error(`${id} returned 304 without a cached response`);
          fetchedAt = now(); expires = fetchedAt + ttlMs;
          return cached!;
        } catch (error) {
          retryAfter = now() + Math.min(ttlMs, 60_000);
          if (cached !== undefined && now() - fetchedAt < ttlMs * 2) return cached;
          throw error;
        }
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}
