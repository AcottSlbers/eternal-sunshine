import type { CameraAttribution, CameraSource, UsagePolicy } from "@/types/camera";

export interface ProviderCapabilities {
  discovery: boolean; batchMetadata: boolean; previewImage: boolean; fullImage: boolean;
  direction: boolean; live: boolean; history: boolean;
}
export interface ProviderDefinition {
  id: CameraSource; name: string; attribution: CameraAttribution; usagePolicy: UsagePolicy;
  capabilities: ProviderCapabilities;
  metadataTtlMs: number; imageTtlMs: number; maximumImageAgeMinutes: number;
  minimumRequestGapMs: number; requireMetadata: boolean; timestampFromImageHeaders: boolean;
  defaultEnabled: boolean; accessNote?: string; licenseVerified: boolean;
}
const minute = 60_000;
const capabilities: ProviderCapabilities = { discovery: true, batchMetadata: true, previewImage: false, fullImage: true, direction: false, live: false, history: false };
function definition(id: CameraSource, name: string, url: string, policy: UsagePolicy, options: Partial<Omit<ProviderDefinition, "capabilities">> & { capabilities?: Partial<ProviderCapabilities> } = {}): ProviderDefinition {
  return { id, name, attribution: { name, url }, usagePolicy: policy, metadataTtlMs: 30 * minute, imageTtlMs: 10 * minute,
    maximumImageAgeMinutes: 60, minimumRequestGapMs: 250, requireMetadata: true, timestampFromImageHeaders: true,
    defaultEnabled: true, licenseVerified: false, ...options, capabilities: { ...capabilities, ...options.capabilities } };
}
const cc = (name: string, url: string): CameraAttribution => ({ name, url, license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" });
export const PROVIDERS: Record<CameraSource, ProviderDefinition> = {
  mock: definition("mock", "Development fixture", "http://localhost:3000", "research-only", { defaultEnabled: false, requireMetadata: false }),
  windy: definition("windy", "Windy Webcams", "https://www.windy.com/webcams", "official-api-restricted", { requireMetadata: false, timestampFromImageHeaders: false, maximumImageAgeMinutes: 720, capabilities: { live: true, previewImage: true }, licenseVerified: true }),
  meteogalicia: definition("meteogalicia", "MeteoGalicia / Xunta de Galicia", "https://www.meteogalicia.gal/web/observacion/camaras", "open-attribution", { metadataTtlMs: 5 * minute, maximumImageAgeMinutes: 720, timestampFromImageHeaders: false, capabilities: { previewImage: true }, licenseVerified: true, attribution: { name: "MeteoGalicia / Xunta de Galicia", url: "https://www.meteogalicia.gal/web/observacion/camaras", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" } }),
  vegagerdin: definition("vegagerdin", "Vegagerðin", "https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur/vefmyndavelar", "official-api-restricted", { capabilities: { direction: true }, accessNote: "Public documented feed; no explicit camera reuse licence located. Attribution retained; commercial reuse not assumed." }),
  digitraffic: definition("digitraffic", "Fintraffic / digitraffic.fi", "https://www.digitraffic.fi/en/road-traffic/", "open-attribution", { metadataTtlMs: 10 * minute, minimumRequestGapMs: 1100, timestampFromImageHeaders: false, licenseVerified: true, capabilities: { previewImage: true, history: true }, attribution: cc("Fintraffic / digitraffic.fi", "https://www.digitraffic.fi/en/road-traffic/"), accessNote: "GATHERING stations and inCollection presets only. Relative road direction is not optical bearing." }),
  nsw: definition("nsw", "Transport for NSW", "https://www.livetraffic.com", "open-attribution", { capabilities: { direction: true }, licenseVerified: true, attribution: { name: "Transport for NSW", url: "https://www.livetraffic.com", license: "TfNSW open-data terms", licenseUrl: "https://opendata.transport.nsw.gov.au/dataset/live-traffic-cameras" } }),
  nzta: definition("nzta", "NZ Transport Agency Waka Kotahi", "https://trafficnz.info", "official-api-restricted", { defaultEnabled: false, imageTtlMs: 5 * minute, capabilities: { previewImage: true, direction: true }, licenseVerified: true, attribution: { name: "NZ Transport Agency Waka Kotahi", url: "https://trafficnz.info", license: "Traffic and Travel API Terms of Use", licenseUrl: "https://www.nzta.govt.nz/about-us/our-data-and-official-information/use-our-data/terms-of-use" }, accessNote: "Opt-in. Preserve image framing and notices; no commercial-use assumption. Current official service needs no account." }),
  ontario511: definition("ontario511", "Ontario 511 / Ministry of Transportation", "https://511on.ca", "open-attribution", { metadataTtlMs: 30 * minute, capabilities: { direction: true }, licenseVerified: true, attribution: { name: "Ontario 511 / Ministry of Transportation", url: "https://511on.ca", license: "Open Government Licence – Ontario", licenseUrl: "https://www.ontario.ca/page/open-government-licence-ontario" }, accessNote: "One list request per 30 minutes, below 10 calls/60 seconds. Per-view direction only when unambiguous." }),
  quebec511: definition("quebec511", "Québec 511 / Ministère des Transports", "https://www.quebec511.info", "open-attribution", { defaultEnabled: false, licenseVerified: true, capabilities: { fullImage: false }, attribution: cc("Québec 511 / Ministère des Transports", "https://www.quebec511.info"), accessNote: "Official WFS returned HTTP 403. Media fields and supported still resource unverified; visual scoring disabled." }),
  usgs: definition("usgs", "USGS Volcano Hazards / Ashcam", "https://volcview.wr.usgs.gov/ashcam-gui/", "official-api-restricted", { metadataTtlMs: 10 * minute, timestampFromImageHeaders: false, capabilities: { previewImage: true, direction: true, history: true }, accessNote: "Ashcam aggregates other owners, including FAA and foreign observatories. Only identified USGS-origin images eligible; external-owner cameras retained for review." }),
  dgt: definition("dgt", "Dirección General de Tráfico", "https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-7", "open-attribution", { defaultEnabled: false, metadataTtlMs: 60 * minute, licenseVerified: true, attribution: { name: "Dirección General de Tráfico", url: "https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-7", license: "Creative Commons Attribution (catalogue)", licenseUrl: "https://www.dgt.es/contenido/aviso-legal/" }, accessNote: "Current v3.7 catalogue found; resource URL unavailable and CKAN API returns 403. Parser awaits official XML sample." }),
  vegvesen: definition("vegvesen", "Statens vegvesen", "https://www.vegvesen.no/fag/teknologi/apne-data/hva-er-datex/", "requires-registration", { defaultEnabled: false, licenseVerified: true, capabilities: { direction: true, live: true }, attribution: { name: "Statens vegvesen", url: "https://www.vegvesen.no", license: "NLOD", licenseUrl: "https://data.norge.no/nlod/en/2.0" }, accessNote: "Register for DATEX node access. No credentials configured; disabled by default." }),
  igepn: definition("igepn", "Instituto Geofísico – EPN", "https://apps2.igepn.edu.ec/IG/webcams.html", "noncommercial-restricted", { defaultEnabled: false, capabilities: { discovery: false }, licenseVerified: true, accessNote: "Official still resources verified. Camera coordinates not verified; manual registry remains empty. No sale/transfer/commercialization; attribution required." }),
};
export const OFFICIAL_PROVIDER_IDS = ["vegagerdin", "digitraffic", "nsw", "nzta", "ontario511", "quebec511", "usgs", "dgt", "vegvesen", "igepn"] as const;
export type OfficialProviderId = typeof OFFICIAL_PROVIDER_IDS[number];
export function providerEnabled(id: CameraSource): boolean {
  const value = process.env[`ENABLE_${id.toUpperCase()}_PROVIDER`];
  return value === undefined ? PROVIDERS[id].defaultEnabled : value === "true";
}
