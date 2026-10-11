import { PROVIDERS } from "@/lib/providers/catalogue";
import type { Camera, CameraSource } from "@/types/camera";
export function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function string(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
export function number(value: unknown): number | undefined { if (value === null || value === "" || value === undefined || typeof value === "boolean") return undefined; const n = Number(value); return Number.isFinite(n) ? n : undefined; }
export function url(value: unknown, base?: string): string | undefined {
  if (!string(value)) return undefined;
  try { const parsed = new URL(value as string, base); return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined; } catch { return undefined; }
}
export function timestamp(value: unknown): string | undefined {
  const text = string(value);
  if (!text || !/(Z|[+-]\d\d:?\d\d|GMT)$/i.test(text)) return undefined;
  const time = Date.parse(text); return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
const bearings: Record<string, number> = { n: 0, north: 0, ne: 45, northeast: 45, e: 90, east: 90, se: 135, southeast: 135, s: 180, south: 180, sw: 225, southwest: 225, w: 270, west: 270, nw: 315, northwest: 315 };
export function cardinal(value: unknown): number | undefined { return typeof value === "string" ? bearings[value.toLowerCase().replace(/[ -]/g, "")] : undefined; }
export function explicitDirection(value: unknown): number | undefined {
  const text = string(value)?.toLowerCase(); if (!text) return undefined;
  const icelandic = /séð til (norðausturs|suðausturs|suðvesturs|norðvesturs|norðurs|austurs|suðurs|vesturs)(?:\s|$|[.,])/.exec(text);
  if (icelandic) return ({ norðausturs: 45, suðausturs: 135, suðvesturs: 225, norðvesturs: 315, norðurs: 0, austurs: 90, suðurs: 180, vesturs: 270 } as Record<string, number>)[icelandic[1]];
  const english = /(?:looking|facing|view(?:ed)?\s+towards?)\s+(?:to\s+the\s+)?(north[ -]?east|north[ -]?west|south[ -]?east|south[ -]?west|north|east|south|west)\b/.exec(text);
  return english ? cardinal(english[1]) : undefined;
}
export function baseCamera(source: CameraSource, id: unknown, name: unknown, lat: unknown, lon: unknown): Camera | null {
  const latitude = number(lat); const longitude = number(lon);
  if ((typeof id !== "string" && typeof id !== "number") || String(id).trim() === "" || latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const provider = PROVIDERS[source];
  return { id: `${source}:${id}`, providerCameraId: String(id), name: string(name) ?? `${provider.name} ${id}`, source,
    latitude, longitude, enabled: true, qualityWeight: 1, directionConfidence: "unknown", attribution: provider.attribution,
    sourceUrl: provider.attribution.url, providerUrl: provider.attribution.url, usagePolicy: provider.usagePolicy,
    originalProvider: provider.name, canonicalProvider: source, hasLiveStream: false, supportsVisualScoring: true };
}
export function withDirection(camera: Camera, direction: number | undefined): Camera {
  return direction === undefined ? camera : { ...camera, viewAzimuth: direction, directionConfidence: "metadata" };
}
