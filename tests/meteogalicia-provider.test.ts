import { describe, expect, it, vi } from "vitest";
import { createMeteoGaliciaCache, MeteoGaliciaWebcamProvider, normalizeMeteoGaliciaCamera, parseMeteoGaliciaTimestamp } from "../lib/providers/meteogalicia-webcam-provider";
import { mergeImportedCameras } from "../lib/camera-registry";
import { getCameraDirection } from "../lib/camera-direction";

const raw = {
  identificador: 10900, nomeCamara: "Ribadeo", lat: 43.5412, lon: -7.03614,
  concello: "Ribadeo", idConcello: 27051, provincia: "Lugo",
  dataUltimaAct: "2026-09-09T21:29:00",
  imaxeCamara: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ribadeoporto/ultima.jpg",
  imaxeCamaraMini: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ribadeoporto/miniUltima.jpg",
};

describe("MeteoGalicia adapter", () => {
  it("normalizes the observed service fields, separate images and attribution without inventing direction", () => {
    const camera = normalizeMeteoGaliciaCamera(raw)!;
    expect(camera).toMatchObject({ id: "meteogalicia:10900", name: "Ribadeo", city: "Ribadeo", country: "Spain", region: "Lugo",
      imageUrl: raw.imaxeCamara, previewImageUrl: raw.imaxeCamaraMini, imageUpdatedAt: "2026-09-09T19:29:00.000Z",
      source: "meteogalicia", attribution: { name: "MeteoGalicia / Xunta de Galicia", license: "CC BY-SA 4.0" } });
    expect(camera.direction).toBeUndefined();
    expect(camera.viewAzimuth).toBeUndefined();
    expect(camera.livePlayer).toBeUndefined();
    expect(camera).not.toHaveProperty("dataUltimaAct");
  });
  it.each([null, { ...raw, lat: NaN }, { ...raw, lon: 190 }, { ...raw, identificador: undefined }, { ...raw, imaxeCamara: "http://127.0.0.1/private", imaxeCamaraMini: "javascript:alert(1)" }])("isolates malformed records and rejects non-provider image URLs", (input) => {
    expect(normalizeMeteoGaliciaCamera(input)).toBeNull();
  });
  it("preserves missing freshness as unknown, not now", () => {
    expect(normalizeMeteoGaliciaCamera({ ...raw, dataUltimaAct: "bad" })?.imageUpdatedAt).toBeUndefined();
  });
  it("does not infer a direction from MeteoGalicia names but honors manual bearings", () => {
    const camera = normalizeMeteoGaliciaCamera({ ...raw, nomeCamara: "West" })!;
    expect(getCameraDirection(camera)).toEqual({ confidence: "unknown" });
    expect(getCameraDirection({ ...camera, manualViewAzimuth: 275 })).toEqual({ confidence: "manual", viewAzimuth: 275 });
  });
  it("keeps manual registry overrides across imports and retains missing cameras", () => {
    const camera = normalizeMeteoGaliciaCamera(raw)!;
    const manual = { ...camera, enabled: false, qualityWeight: .65, manualViewAzimuth: 278, manualQualityOverride: 76, notes: "Curated", permanentlyRejected: true };
    const missing = { ...camera, id: "meteogalicia:missing" };
    const merged = mergeImportedCameras([manual, missing], [{ ...camera, name: "Updated name" }]);
    expect(merged[0]).toMatchObject({ ...manual, name: "Updated name" });
    expect(merged[1]).toEqual(missing);
  });
});

describe("MeteoGalicia timestamp interpretation", () => {
  it.each([
    ["2026-01-10T18:00:00", "2026-01-10T17:00:00.000Z"],
    ["2026-07-10T18:00:00", "2026-07-10T16:00:00.000Z"],
    ["2026-03-29T01:59:00", "2026-03-29T00:59:00.000Z"],
    ["2026-03-29T03:00:00", "2026-03-29T01:00:00.000Z"],
    ["2026-10-25T02:30:00", "2026-10-25T00:30:00.000Z"],
    ["2026-07-10T18:00:00Z", "2026-07-10T18:00:00.000Z"],
    ["2026-07-10T18:00:00+02:00", "2026-07-10T16:00:00.000Z"],
  ])("parses %s independently of machine timezone", (input, expected) => {
    expect(parseMeteoGaliciaTimestamp(input)).toBe(expected);
  });
  it.each(["2026-03-29T02:30:00", "2026-02-30T12:00:00", "2026-01-01T25:00:00", "wrong", undefined])("rejects invalid or nonexistent local timestamp %s", (input) => {
    expect(parseMeteoGaliciaTimestamp(input)).toBeUndefined();
  });
});

describe("MeteoGalicia metadata request discipline", () => {
  it("coalesces concurrent requests and reuses one 5-minute response across cameras and instances", async () => {
    let now = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ listaCamaras: [raw] })));
    const load = createMeteoGaliciaCache(fetcher, () => now);
    const a = new MeteoGaliciaWebcamProvider(load); const b = new MeteoGaliciaWebcamProvider(load);
    expect(await a.getCameras([])).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await Promise.all([a.getCamera("meteogalicia:10900"), b.getCamera("meteogalicia:10900")]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 299_999;
    await b.getCameras(["meteogalicia:10900"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 300_000;
    await a.getCamera("meteogalicia:10900");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not silently serve stale metadata on failure and can recover", async () => {
    let now = 0;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ listaCamaras: [raw] })))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ listaCamaras: [raw] })));
    const load = createMeteoGaliciaCache(fetcher, () => now);
    await load(); now = 300_001;
    await expect(load()).rejects.toThrow("503");
    expect(await load()).toHaveLength(1);
  });
  it("reports malformed metadata rather than empty success", async () => {
    const load = createMeteoGaliciaCache(vi.fn<typeof fetch>().mockResolvedValue(new Response("{}")));
    await expect(load()).rejects.toThrow("listaCamaras");
  });
});
