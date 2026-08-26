import type { Camera, CameraLivePlayer } from "@/types/camera";
import type { BoundingBox, WebcamProvider } from "@/lib/providers/webcam-provider";
import { inferViewAzimuth } from "@/lib/camera-direction";

const BASE_URL = "https://api.windy.com/webcams/api/v3";
const INCLUDE = "categories,images,location,player,urls";
const DEFAULT_TIMEOUT_MS = 10_000;

interface WindyWebcam {
  webcamId?: number;
  status?: string;
  title?: string;
  viewCount?: number;
  lastUpdatedOn?: string;
  categories?: Array<{ id?: string; name?: string }>;
  images?: { current?: Record<string, string>; sizes?: Record<string, { width?: number; height?: number }> };
  location?: { city?: string; region?: string; country?: string; latitude?: number; longitude?: number };
  player?: unknown;
  urls?: unknown;
}

interface WindyListResponse { total?: number; webcams?: WindyWebcam[] }

export class WindyConfigurationError extends Error {
  constructor() { super("WINDY_API_KEY is missing. Add it to .env.local before using the Windy provider."); }
}

export class WindyApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeWebUrl(value: unknown, httpsOnly = false): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (httpsOnly ? url.protocol !== "https:" : url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function getWindyUrl(rawUrls: unknown, field: "detail" | "provider"): string | undefined {
  return isRecord(rawUrls) ? normalizeWebUrl(rawUrls[field]) : undefined;
}

export function normalizeWindyLivePlayer(rawPlayer: unknown): CameraLivePlayer | undefined {
  if (!isRecord(rawPlayer)) return undefined;
  const url = normalizeWebUrl(rawPlayer.live, true);
  if (!url) return undefined;
  const hostname = new URL(url).hostname.toLowerCase();
  const isWindyEmbed = hostname === "windy.com" || hostname.endsWith(".windy.com");
  return isWindyEmbed
    ? { url, type: "windy-iframe", embedUrl: url }
    : { url, type: "external-link" };
}

function chooseImage(images?: WindyWebcam["images"]): string | undefined {
  const current = images?.current;
  if (!current) return undefined;
  return current.preview ?? current.full ?? current.medium ?? current.small ?? current.icon ?? Object.values(current).find((value) => typeof value === "string");
}

export function normalizeWindyWebcam(raw: WindyWebcam): Camera | null {
  const latitude = raw.location?.latitude;
  const longitude = raw.location?.longitude;
  if (typeof raw.webcamId !== "number" || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const imageUrl = chooseImage(raw.images);
  const name = raw.title?.trim() || raw.location?.city || `Windy webcam ${raw.webcamId}`;
  const viewAzimuth = inferViewAzimuth(name);
  const livePlayer = normalizeWindyLivePlayer(raw.player);
  const largestSize = Object.values(raw.images?.sizes ?? {}).sort((a, b) => ((b.width ?? 0) * (b.height ?? 0)) - ((a.width ?? 0) * (a.height ?? 0)))[0];
  return {
    id: String(raw.webcamId), name,
    latitude, longitude, country: raw.location?.country, region: raw.location?.region,
    source: "windy", sourceUrl: getWindyUrl(raw.urls, "detail"), providerUrl: getWindyUrl(raw.urls, "provider"),
    hasLiveStream: Boolean(livePlayer), livePlayer,
    categories: raw.categories?.flatMap((category) => [category.id, category.name].filter((value): value is string => Boolean(value))),
    enabled: raw.status === "active", qualityWeight: 1,
    viewAzimuth, viewAzimuthSource: viewAzimuth === undefined ? undefined : "name-inferred", directionConfidence: viewAzimuth === undefined ? "unknown" : "inferred",
    imageUrl, imageUpdatedAt: raw.lastUpdatedOn, lastKnownImageUrl: imageUrl, lastKnownImageTimestamp: raw.lastUpdatedOn,
    discovery: { longitudeBucket: 0, viewCount: raw.viewCount, imageWidth: largestSize?.width, imageHeight: largestSize?.height, discoveredAt: new Date().toISOString(), candidateScore: { total: 0, active: 0, currentImage: 0, freshness: 0, scenicCategory: 0, popularity: 0, resolution: 0, unsuitablePenalty: 0 } },
  };
}

export class WindyWebcamProvider implements WebcamProvider {
  private readonly apiKey: string;
  constructor(apiKey = process.env.WINDY_API_KEY, private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!apiKey) throw new WindyConfigurationError();
    this.apiKey = apiKey;
  }

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { headers: { "x-windy-api-key": this.apiKey }, signal: controller.signal });
      if (!response.ok) throw new WindyApiError(`Windy request failed with HTTP ${response.status}.`, response.status);
      const data: unknown = await response.json();
      if (!isRecord(data)) throw new WindyApiError("Windy returned an unexpected response.");
      return data;
    } catch (error) {
      if (error instanceof WindyApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new WindyApiError(`Windy request timed out after ${this.timeoutMs} ms.`);
      throw new WindyApiError(error instanceof Error ? error.message : "Unknown Windy request error.");
    } finally { clearTimeout(timeout); }
  }

  async discoverByBoundingBox(bbox: BoundingBox, limit = 50): Promise<Camera[]> {
    const data = await this.request("/webcams", { bbox: `${bbox.north},${bbox.east},${bbox.south},${bbox.west}`, include: INCLUDE, lang: "en", limit: String(Math.min(50, limit)), sortKey: "popularity", sortDirection: "desc" }) as WindyListResponse;
    if (!Array.isArray(data.webcams)) throw new WindyApiError("Windy list response does not contain a webcams array.");
    return data.webcams.flatMap((webcam) => { const camera = normalizeWindyWebcam(webcam); return camera ? [camera] : []; });
  }

  async getCamera(id: string): Promise<Camera | null> {
    const data = await this.request(`/webcams/${encodeURIComponent(id)}`, { include: INCLUDE, lang: "en" }) as WindyWebcam;
    return normalizeWindyWebcam(data);
  }

  async getCameras(ids: string[]): Promise<Camera[]> {
    if (ids.length === 0) return [];
    const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50));
    const settled = await Promise.allSettled(chunks.map(async (chunk) => {
      const data = await this.request("/webcams", { webcamIds: chunk.join(","), include: INCLUDE, lang: "en", limit: String(chunk.length) }) as WindyListResponse;
      return Array.isArray(data.webcams) ? data.webcams.flatMap((webcam) => { const camera = normalizeWindyWebcam(webcam); return camera ? [camera] : []; }) : [];
    }));
    return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  }
}
