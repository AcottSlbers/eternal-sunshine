# Phase 3.3 real-data evaluation

Snapshot: 2026-09-09, 20:32:33 UTC. Live feeds and astronomical eligibility change; these are measurements, not permanent expected scores.

## Official MeteoGalicia response

The official [JSON service](https://servizos.meteogalicia.gal/mgrss/observacion/jsonCamaras.action) returned HTTP 200, one root key `listaCamaras`, containing 34 camera objects. Import completed at 20:21:54 UTC with 34 namespaced records. No global Windy discovery was run; the existing 300-camera Windy Gold file was not changed.

Exact observed example (including offset-free timestamp):

```json
{
  "listaCamaras": [
    {
      "concello": "Ribadeo",
      "dataUltimaAct": "2026-09-09T21:29:00",
      "idConcello": 27051,
      "identificador": 10900,
      "imaxeCamara": "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ribadeoporto/ultima.jpg",
      "imaxeCamaraMini": "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ribadeoporto/miniUltima.jpg",
      "lat": 43.5412,
      "lon": -7.03614,
      "nomeCamara": "Ribadeo",
      "provincia": "Lugo"
    }
  ]
}
```

The array above shows one unchanged object, not all 34. The [official field documentation](https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_camaras_es.pdf) distinguishes normal and mini images but does not specify the timezone of `dataUltimaAct`. The [Xunta open-data catalogue](https://abertos.xunta.gal/es/catalogo/medio-abiente/-/dataset/0385/json-camaras-meteogalicia) describes application reuse and lists CC BY-SA 4.0. Only the JSON service, images, catalogue and documentation were inspected; no camera-page HTML was scraped.

A Ribadeo response fetched at 20:16 UTC carried the offset-free value above. Interpreting it as UTC would put it over an hour in the future; Europe/Madrid gives 19:29 UTC. The adapter therefore explicitly interprets suffixless values as regional Europe/Madrid time, using Intl DST rules, not a fixed offset. This is an inference, not a documented timezone contract. Explicit offsets are respected. Invalid/missing timestamps cannot enter current ranking; stale images use the existing 12-hour rejection rule. Portosín (meteogalicia:10902) was stale at 07:40 UTC; 33 other imported timestamps were within the freshness window. Image Last-Modified was sometimes newer than JSON metadata, so freshness is deliberately conservative.

Observed Ribadeo dimensions: mini 280×158 (3,040 bytes), normal 1280×720 (35,856 bytes). Runtime analyzes the mini after internal resizing and displays the normal image. Registry import downloads metadata only. No audit images are retained in the repository.

Normalized attribution is MeteoGalicia / Xunta de Galicia, with source and CC BY-SA 4.0 links on public images. Windy retains its own attribution. The adapter does not infer direction or fabricate live streams.

## Provider distribution

| Provider | Registry | Known fresh timestamps | Astronomical | Evaluated | Images analyzed | Visible | Featured | Public |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Windy | 300 | 17 | 18 | 18 | 16 | 2 | 1 | 2 |
| MeteoGalicia | 34 | 33 | 0 | 0 | 0 | 0 | 0 | 0 |

Known-fresh counts use the latest available metadata, including imported timestamps for unevaluated cameras; they are not a fresh global health scan. Galicia was already outside the evening astronomical window. Zero current Galician sunsets is the truthful result, not a provider failure. The real import and image endpoints worked, but a real sunset-time Galician ranking remains to be observed in a later natural window. Runtime ordering/cache/failure behavior is covered by integration tests without faking this live snapshot.

The MeteoGalicia provider is lazy: no local candidates means no metadata call, no image requests. A shared pending request and five-minute process cache prevent per-camera service requests. Failed refreshes do not reuse expired metadata as current data. Provider-specific failures are isolated. Adding this provider makes no additional Windy calls. Imported metadata quality was 55 with the existing evaluator; that is not a visual premium assessment or a provider boost. The existing Windy coverage report has not been recomputed as a combined pool.

## Same-image before/after audit

The previous committed scorer and new scorer were run on identical downloaded bytes with identical current phase input, isolating the algorithm change from moving time and changing images. Camera IDs were used only to select audit inputs, never in scoring code. The user's earlier approximate 31/31 observation was not reproduced exactly at this later time.

| Image | Phase input | Previous evidence | New evidence | Previous SunsetScore | New SunsetScore |
| --- | ---: | ---: | ---: | ---: | ---: |
| Selfoss: Hólmur, updated 20:13:13 UTC | 46 | 28 | 0 | 23 | 0 |
| Ribeira do Meio / Lajes do Pico, updated 20:24:25 UTC | 70.8 | 25.9 | 39.5 | 22.1 | 35.5 |

Visual inspection confirmed blue/gray sky, mountains, yellow grass and roads at Selfoss, versus a bright warm horizon beneath clouds at Lajes, above many warm-colored roofs. The old order was wrong; the new gap is 35.5 points in favor of the genuine sunset.

| Supporting metric | Selfoss | Lajes do Pico |
| --- | ---: | ---: |
| estimatedHorizonY (0–1, top to bottom) | 0.203 | 0.427 |
| horizonConfidence (0–100) | 45.5 | 100 |
| skyConfidence (0–100) | 67.8 | 95.4 |
| upper sky sunset-color ratio | 0 | 0 |
| horizon sunset-color ratio | 0.006 | 0.136 |
| foreground sunset-color ratio | 0.237 | 0.177 |
| foreground leakage ratio | 0.997 | 0.823 |
| sunsetColorGeometryScore | 0 | 99.5 |
| horizonGlowScore | 0 | 84 |
| intenseHorizonGlow | 0 | 84 |
| foregroundWarmPenalty | 45 | 0.8 |

Lajes shows why leakage alone must not veto a real sunset: coherent, bright sky glow validates its small horizon region despite orange roofs below. The reduction of the foreground penalty is conditioned on verified sky geometry/glow, not on camera identity.

Synthetic controls at phase 95 measured 78.6 for an intense horizon sunset, 59.9 for subtle twilight, and 0 for the blue-sky/yellow-ground scene. Tests also cover high horizons, warm roofs under real glow, isolated orange pixels and low-confidence fallback, alongside all previous gray/snow/road/harbor/night/placeholder controls. Vila do Porto was still visible in an earlier intermediate run, but outside the astronomical window at the final snapshot; there is no final current Vila score to claim.

## Current public ranking and complete candidate scores

Best image: Anchieta, Windy, evidence 35.2, beauty 19.6, SunsetScore 30.5, final 30.1. Visual inspection confirmed warm cloud illumination and an intense sunset opening over the sea. Lajes remained a public twilight card (beauty 19.2), not hero-eligible at this later phase.

Across all 16 analyzed images: minimum SunsetScore **0**, median **0**, maximum **30.5**. Across the two visible public images only: minimum **29.1**, median **29.8**, maximum **30.5**. Two other cameras were rejected before analysis. There was no spectacular high-scoring sunset in this snapshot; moderate real glows now separate clearly from mostly zero-scoring non-sunsets.

| Provider | Location | Evidence | SunsetScore | FinalScore | Result |
| --- | --- | ---: | ---: | ---: | --- |
| windy | Anchieta › South-west: Anchieta es | 35.2 | 30.5 | 30.1 | Public |
| windy | Ribeira do Meio › West: Casa do Flores - Lajes Do Pico - Espaço Talassa, observation des baleines et dauphins - Mount Pico | 33.4 | 29.1 | 28.1 | Public |
| windy | Bolungarvik | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Vogar: Mývatn | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Greenland: Freya Gletscher - Cam 2 | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | ingeyri › North-west: Höfði Westfjords | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Reykjavik: Harbour - Miðbakki | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | unknown: Svycarsky Dvur Jetrichovice | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Capelo › West: Capelinhos Volcano Car Park - Capelinhos Volcano Interpretation Center | — | — | — | Rejected: image is stale (20185 minutes old) |
| windy | Piuma › South-west: Praia Acaica | 1.3 | 0.9 | 0.9 | Rejected: insufficient sunset evidence |
| windy | Selfoss: Hólmur | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | unknown: webcam-haven | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Hofn: í Hornafirði north, Vatnajökull glancier | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Bird Island Station › South-west | 0 | 0 | 0 | Rejected: Image is overwhelmingly dark. |
| windy | Nova Friburgo › North-east: Rua Henrique Zamith | — | — | — | Rejected: camera points 129° away from the sun |
| windy | Angra do Heroismo › South: Vista baía de Angra do Heroísmo - Monte Brasil | 0 | 0 | 0 | Rejected: insufficient sunset evidence |
| windy | Bird Island Station: Antarctica | 0 | 0 | 0 | Rejected: Image is overwhelmingly dark. |
| windy | Nova Friburgo: Alto das Braunes - Serra do Mar | 0 | 0 | 0 | Rejected: insufficient sunset evidence |

All supporting metrics and Beauty are exposed for every scored candidate in `/dev/ranking`, `/api/ranking` and the diagnostic command, including rejected candidates. Ratios and horizon Y are 0–1, confidence/geometry/glow scores 0–100. Warm foreground does not contribute positive sky evidence; texture/contrast remain beauty enhancements. Existing visibility gates were not increased.

## Remaining weaknesses and verification limits

- The horizon estimate is a deterministic spatial heuristic, not semantic segmentation. At Anchieta it selected Y=0.846 while the visible sea horizon is nearer mid-image: dark foreground/reflection boundaries still confuse it. Sky confidence was 68.8, geometry 78.2, sky color ratio 0.103, horizon ratio 0.233, leakage 0.032, but glow metrics were zero. This is a real sunset, not a comparable Selfoss false positive, yet it is under-recognized and the estimated horizon is visibly inaccurate. These metrics are reported rather than concealed.
- Layered clouds, large water reflections, roofs at the skyline and very high/low horizons can still over- or underestimate evidence. The fallback at low confidence is inspectable, not a guarantee.
- The unsuffixed provider timestamp's timezone should ideally be confirmed with MeteoGalicia. DST tests establish deterministic handling of the stated regional assumption, not independent proof of that assumption.
- Metadata quality alone does not establish resolution, scenic framing or actual sky visibility for all 34 new cameras. Manual review and optional explicit direction curation remain useful.
- This checkout has no `MAX_RUNTIME_IMAGE_ANALYSES` symbol. No new or existing Windy API limits were changed; existing solar filtering and concurrency controls remain in place.
- No external image/vision API, ML, permanent image store, credential change, global Windy discovery, coverage-optimizer redesign, live-player redesign, hysteresis/dedupe change, or LocalTime edit was made.

## Validation results

- `npm test`: 125 tests passed across 16 files.
- `npm run lint`: passed without warnings or errors.
- `npm run build`: optimized build, TypeScript and route generation passed.
- `git diff --check`: passed.
- Live local HTTP smoke checks: `/`, `/dev/cameras`, `/dev/coverage`, `/dev/ranking`, `/api/ranking` all returned 200. Ranking JSON included all provider diagnostic keys.
- `.env.local` remains ignored and untracked; the scoped credential-pattern scan found no matches. No credentials were printed or added.

The HTTP checks are not an interactive browser/playback regression test. Existing live-player and hydration code was preserved; product serialization/attribution behavior is covered by tests.

Run `npm run diagnose-sunset-scores` for a new time-sensitive snapshot; `npm run dev` starts the local app.
