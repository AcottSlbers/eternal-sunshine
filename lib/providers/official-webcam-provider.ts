import type { Camera } from "@/types/camera";
import type { BoundingBox, WebcamProvider } from "./webcam-provider";
import { createFeedCache } from "./http-cache";
import { type OfficialProviderId, PROVIDERS } from "./catalogue";
import { normalizeDigitraffic, normalizeNsw, normalizeNzta, normalizeOntario, normalizeUsgs, normalizeVegagerdin } from "./official-normalizers";
import { record } from "./normalize";
import igepn from "@/data/providers/igepn-cameras.json";

export const FEED_URLS = {
  vegagerdin: "https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1",
  digitraffic: "https://tie.digitraffic.fi/api/weathercam/v1/stations",
  digitrafficData: "https://tie.digitraffic.fi/api/weathercam/v1/stations/data",
  nsw: "https://data.livetraffic.com/cameras/traffic-cam.json",
  nzta: "https://trafficnz.info/service/traffic/rest/4/cameras/all",
  ontario511: "https://511on.ca/api/v2/get/cameras",
  quebec511: "https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&srsname=EPSG:4326&outputformat=geojson",
  usgs: "https://volcview.wr.usgs.gov/ashcam-api/webcamApi/webcams",
  vegvesen: "https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetCCTVSiteTable/pullsnapshotdata",
} as const;
export function createOfficialLoader(id: OfficialProviderId, fetcher: typeof fetch = fetch) {
  if (id === "igepn") return { load: async () => igepn as Camera[], ageMs: () => null };
  if (id === "dgt" || id === "vegvesen") return {
    ageMs: () => null,
    load: async (): Promise<Camera[]> => { throw new Error(id === "dgt" ? "DGT v3.7 current XML resource unavailable; official catalogue access required" : "Vegvesen requires DATEX access and a verified site/status sample; see docs/providers.md"); },
  };
  if (id === "digitraffic") {
    const metadata = createFeedCache(id, FEED_URLS.digitraffic, JSON.parse, 24 * 3600_000, fetcher);
    const data = createFeedCache(id, FEED_URLS.digitrafficData, JSON.parse, PROVIDERS[id].metadataTtlMs, fetcher);
    return { ageMs: data.ageMs, load: async () => { const [stations, times] = await Promise.all([metadata.load(), data.load()]); return normalizeDigitraffic(stations, times); } };
  }
  const normalize = { vegagerdin: normalizeVegagerdin, nsw: normalizeNsw, nzta: normalizeNzta, ontario511: normalizeOntario, usgs: normalizeUsgs,
    quebec511: (raw: unknown): Camera[] => {
      if (!Array.isArray(record(raw).features)) throw new Error("Québec expected official WFS GeoJSON features");
      // No observed media schema: fail closed rather than invent a snapshot URL.
      throw new Error("Québec response available; media mapping needs a verified snapshot schema before import");
    },
  }[id];
  return createFeedCache(id, FEED_URLS[id], (body) => normalize(JSON.parse(body)), undefined, fetcher);
}
const runtime = globalThis as typeof globalThis & { officialProviderLoaders?: Map<OfficialProviderId, ReturnType<typeof createOfficialLoader>> };
const loaders = runtime.officialProviderLoaders ??= new Map();
export function getOfficialLoader(id: OfficialProviderId) {
  if (!loaders.has(id)) loaders.set(id, createOfficialLoader(id));
  return loaders.get(id)!;
}
export class OfficialWebcamProvider implements WebcamProvider {
  readonly capabilities;
  constructor(readonly id: OfficialProviderId, private readonly loader = getOfficialLoader(id)) { this.capabilities = PROVIDERS[id].capabilities; }
  async discoverByBoundingBox(bbox: BoundingBox, limit = Infinity): Promise<Camera[]> {
    return (await this.loader.load()).filter((c) => c.latitude >= bbox.south && c.latitude <= bbox.north && c.longitude >= bbox.west && c.longitude <= bbox.east).slice(0, limit);
  }
  async getCameras(ids: string[]): Promise<Camera[]> {
    if (!ids.length) return [];
    const wanted = new Set(ids);
    return (await this.loader.load()).filter((c) => wanted.has(c.id));
  }
  async getCamera(id: string): Promise<Camera | null> { return (await this.getCameras([id]))[0] ?? null; }
}
