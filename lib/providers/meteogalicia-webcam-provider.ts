import { METEOGALICIA_CACHE_MS } from "@/lib/config";
import { METEOGALICIA_ATTRIBUTION } from "@/lib/providers/attribution";
import type { Camera } from "@/types/camera";
import type { BoundingBox, WebcamProvider } from "@/lib/providers/webcam-provider";

export const METEOGALICIA_SERVICE_URL = "https://servizos.meteogalicia.gal/mgrss/observacion/jsonCamaras.action";
const localClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function civilTime(instant: number): number {
  const parts = Object.fromEntries(localClock.formatToParts(instant).map((part) => [part.type, part.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

export function parseMeteoGaliciaTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, second);
  if (new Date(wallTime).toISOString().slice(0, 19) !== value.replace(" ", "T")) return undefined;
  // The service currently omits offsets. Interpret its regional wall clock explicitly;
  // never depend on the server TZ. Sample both sides of a DST transition and round-trip.
  const offsets = new Set([-36, 0, 36].map((hours) => {
    const instant = wallTime + hours * 3600_000;
    return civilTime(instant) - instant;
  }));
  const matches = [...offsets].map((offset) => wallTime - offset).filter((instant) => civilTime(instant) === wallTime);
  // Missing spring-forward times are invalid; ambiguous fall-back times use the older
  // instant, conservatively avoiding a one-hour freshness overstatement.
  return matches.length ? new Date(Math.min(...matches)).toISOString() : undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
function imageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "meteogalicia.gal" || url.hostname.endsWith(".meteogalicia.gal")) ? url.href : undefined;
  } catch { return undefined; }
}

export function normalizeMeteoGaliciaCamera(raw: unknown): Camera | null {
  if (!record(raw) || !Number.isSafeInteger(raw.identificador) || typeof raw.lat !== "number" || typeof raw.lon !== "number"
    || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon) || Math.abs(raw.lat) > 90 || Math.abs(raw.lon) > 180) return null;
  const full = imageUrl(raw.imaxeCamara);
  const mini = imageUrl(raw.imaxeCamaraMini);
  if (!full && !mini) return null;
  return {
    id: `meteogalicia:${raw.identificador}`, name: typeof raw.nomeCamara === "string" ? raw.nomeCamara : `MeteoGalicia ${raw.identificador}`,
    latitude: raw.lat, longitude: raw.lon, country: "Spain",
    region: typeof raw.provincia === "string" ? raw.provincia : "Galicia",
    city: typeof raw.concello === "string" ? raw.concello : undefined,
    source: "meteogalicia", sourceUrl: METEOGALICIA_ATTRIBUTION.url, providerUrl: METEOGALICIA_ATTRIBUTION.url,
    attribution: METEOGALICIA_ATTRIBUTION, imageUrl: full ?? mini, previewImageUrl: mini ?? full,
    imageUpdatedAt: parseMeteoGaliciaTimestamp(raw.dataUltimaAct),
    hasLiveStream: false, enabled: true, qualityWeight: 1, directionConfidence: "unknown",
  };
}

export function createMeteoGaliciaCache(fetcher: typeof fetch = fetch, now: () => number = Date.now, ttlMs = METEOGALICIA_CACHE_MS) {
  let cached: Camera[] | undefined;
  let expiresAt = 0;
  let pending: Promise<Camera[]> | undefined;
  return () => {
    if (cached && now() < expiresAt) return Promise.resolve(cached);
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(METEOGALICIA_SERVICE_URL, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!response.ok) throw new Error(`MeteoGalicia metadata returned HTTP ${response.status}`);
      const raw: unknown = await response.json();
      if (!record(raw) || !Array.isArray(raw.listaCamaras)) throw new Error("MeteoGalicia response has no listaCamaras array");
      const cameras = raw.listaCamaras.flatMap((item) => { const camera = normalizeMeteoGaliciaCamera(item); return camera ? [camera] : []; });
      cached = cameras;
      expiresAt = now() + ttlMs;
      return cameras;
    })().finally(() => { pending = undefined; });
    return pending;
  };
}

const runtime = globalThis as typeof globalThis & { meteogaliciaMetadata?: ReturnType<typeof createMeteoGaliciaCache> };
const loadMetadata = runtime.meteogaliciaMetadata ??= createMeteoGaliciaCache();

export class MeteoGaliciaWebcamProvider implements WebcamProvider {
  constructor(private readonly load = loadMetadata) {}
  async getCameras(ids: string[]): Promise<Camera[]> {
    if (!ids.length) return [];
    const wanted = new Set(ids);
    return (await this.load()).filter((camera) => wanted.has(camera.id));
  }
  async getCamera(id: string): Promise<Camera | null> { return (await this.getCameras([id]))[0] ?? null; }
  async discoverByBoundingBox(bbox: BoundingBox, limit = Infinity): Promise<Camera[]> {
    return (await this.load()).filter((camera) => camera.latitude >= bbox.south && camera.latitude <= bbox.north
      && camera.longitude >= bbox.west && camera.longitude <= bbox.east).slice(0, limit);
  }
}
