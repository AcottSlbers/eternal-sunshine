import type { Camera } from "@/types/camera";
import { array, baseCamera, cardinal, explicitDirection, number, record, string, timestamp, url, withDirection } from "./normalize";

export function normalizeVegagerdin(raw: unknown): Camera[] {
  if (!Array.isArray(raw)) throw new Error("Vegagerdin expected a camera array");
  return raw.flatMap((item) => {
    const r = record(item); const image = url(r.Slod); if (!image) return [];
    const viewId = new URL(image).pathname.split("/").at(-1)?.replace(/\.[^.]+$/, "");
    const camera = baseCamera("vegagerdin", `${r.Maelist_nr}:${viewId}`, r.Skyring ?? r.Myndavel, r.Breidd, r.Lengd);
    return camera ? [{ ...withDirection(camera, explicitDirection(r.Skyring)), imageUrl: image, country: "Iceland", region: string(r.Myndavel), viewDescription: string(r.Skyring), categories: ["traffic", "weather"] }] : [];
  });
}
export function normalizeDigitraffic(raw: unknown, data: unknown, details: unknown[] = []): Camera[] {
  const collection = record(raw); if (!Array.isArray(collection.features)) throw new Error("Digitraffic expected GeoJSON features");
  const times = new Map<string, string | undefined>();
  for (const station of array(record(data).stations)) for (const preset of array(record(station).presets)) { const p = record(preset); times.set(String(p.id), timestamp(p.measuredTime)); }
  const detailById = new Map(details.map((item) => [String(record(item).id), item]));
  return collection.features.flatMap((item) => {
    const original = record(item); const feature = record(detailById.get(String(original.id)) ?? item); const p = record(feature.properties);
    if (p.collectionStatus !== "GATHERING" || (p.state !== null && p.state !== undefined && p.state !== "OK")) return [];
    const coordinates = array(record(feature.geometry).coordinates);
    return array(p.presets).flatMap((preset) => {
      const view = record(preset); if (view.inCollection !== true || !/^C\d+$/.test(String(view.id))) return [];
      const camera = baseCamera("digitraffic", view.id, `${p.name} / ${view.presentationName ?? view.id}`, coordinates[1], coordinates[0]); if (!camera) return [];
      const image = url(view.imageUrl) ?? `https://weathercam.digitraffic.fi/${view.id}.jpg`;
      // Increasing/decreasing road chainage and SPECIAL_DIRECTION are not bearings.
      return [{ ...withDirection(camera, explicitDirection(view.presentationName)), country: "Finland", region: string(p.province), imageUrl: image,
        previewImageUrl: `${image}?thumbnail=true`, imageUpdatedAt: times.get(String(view.id)), timestampSource: "metadata" as const,
        viewDescription: [view.presentationName, view.direction].filter(Boolean).join(" / "), categories: ["traffic", "weather"] }];
    });
  });
}
export function normalizeNsw(raw: unknown): Camera[] {
  const collection = record(raw); if (!Array.isArray(collection.features)) throw new Error("NSW expected GeoJSON features");
  return collection.features.flatMap((item) => {
    const f = record(item); const p = record(f.properties); const xy = array(record(f.geometry).coordinates);
    const camera = baseCamera("nsw", f.id, p.title, xy[1], xy[0]); if (!camera) return [];
    return [{ ...withDirection(camera, explicitDirection(p.view)), country: "Australia", region: string(p.region), imageUrl: url(p.href),
      viewDescription: string(p.view), categories: ["traffic"], supportsVisualScoring: Boolean(url(p.href)),
      attribution: { ...camera.attribution!, text: string(record(collection.rights).copyright), licenseUrl: url(record(collection.rights).licence) ?? camera.attribution?.licenseUrl } }];
  });
}
export function normalizeOntario(raw: unknown): Camera[] {
  if (!Array.isArray(raw)) throw new Error("Ontario511 expected a camera array");
  return raw.flatMap((item) => {
    const r = record(item); const views = array(r.Views);
    return views.flatMap((item) => {
      const v = record(item); const camera = baseCamera("ontario511", `${r.Id}:${v.Id}`, `${r.Location} / ${v.Description ?? v.Id}`, r.Latitude, r.Longitude); if (!camera) return [];
      // The docs describe Direction as camera-facing. Do not apply one parent bearing to multiple views.
      const facing = explicitDirection(v.Description) ?? (views.length === 1 ? cardinal(string(r.Direction)?.replace(/bound$/i, "")) : undefined);
      return [{ ...withDirection(camera, facing), country: "Canada", region: "Ontario", imageUrl: url(v.Url), enabled: v.Status === "Enabled",
        viewDescription: string(v.Description), originalProvider: string(r.Source), categories: ["traffic", "weather"], supportsVisualScoring: Boolean(url(v.Url)) }];
    });
  });
}
export function normalizeNzta(raw: unknown): Camera[] {
  const cameras = record(record(raw).response).camera; if (!Array.isArray(cameras)) throw new Error("NZTA expected response.camera array");
  return cameras.flatMap((item) => {
    const r = record(item); const camera = baseCamera("nzta", r.id, r.name, r.latitude, r.longitude); if (!camera) return [];
    const facing = explicitDirection(r.description) ?? cardinal(string(r.description)?.match(/^(north[ -]?east|north[ -]?west|south[ -]?east|south[ -]?west|north|south|east|west)\s+along\b/i)?.[1]);
    return [{ ...withDirection(camera, facing), country: "New Zealand", region: string(record(r.region).name), imageUrl: url(r.imageUrl, "https://trafficnz.info"),
      previewImageUrl: url(r.thumbUrl, "https://trafficnz.info"), providerUrl: url(r.viewUrl, "https://trafficnz.info"),
      enabled: r.offline === false && r.underMaintenance === false, preserveImageFraming: true, viewDescription: string(r.description), categories: ["traffic"] }];
  });
}
export function normalizeUsgs(raw: unknown): Camera[] {
  const cameras = record(raw).webcams; if (!Array.isArray(cameras)) throw new Error("USGS expected webcams array");
  return cameras.flatMap((item) => {
    const r = record(item); const camera = baseCamera("usgs", r.webcamCode, r.webcamName, r.latitude, r.longitude); if (!camera) return [];
    const bearing = number(r.bearingDeg); const image = r.hasImages === "Y" ? url(r.currentImageUrl) : undefined;
    const external = url(r.externalUrl); const usgsOwned = external ? new URL(external).hostname.endsWith(".usgs.gov") : /^(kilauea|mauna-loa)-/.test(String(r.webcamCode));
    const time = number(record(r.newestImage).imageTimestamp);
    return [{ ...withDirection(camera, bearing !== undefined && bearing >= 0 && bearing < 360 ? bearing : undefined),
      imageUrl: image, previewImageUrl: image ? url(r.currentMediumImageUrl) : undefined,
      imageUpdatedAt: time && time > 0 ? new Date(time * 1000).toISOString() : undefined, timestampSource: "metadata" as const,
      region: string(r.vName), country: camera.latitude > 18 && camera.longitude < -100 ? "United States" : undefined,
      originalProvider: r.faaInd === "Y" ? "FAA (via USGS Ashcam)" : external ? new URL(external).hostname : "USGS (origin review required)",
      enabled: Boolean(image) && usgsOwned, supportsVisualScoring: Boolean(image) && usgsOwned,
      sourceUrl: external ?? camera.sourceUrl, usagePolicy: usgsOwned ? "open-commercial" as const : "research-only" as const,
      attribution: usgsOwned ? { ...camera.attribution!, license: "USGS public-domain imagery", licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits" } : camera.attribution,
      categories: ["mountain", "landscape"], notes: usgsOwned ? undefined : "External image owner not verified for reuse; excluded from Gold." }];
  });
}
