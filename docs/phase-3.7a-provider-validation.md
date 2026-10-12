# Phase 3.7a — Official provider validation

Validated on **2026-10-11**, **12:31:21–12:32:25 UTC**. NSW diagnostics continued through 12:33:21 UTC. This is a bounded, single-observation validation, not a global camera review or proof of sunset performance.

## Outcome

**No provider is recommended for unconditional public integration yet.** Digitraffic is technically usable but the sampled views are predominantly unsuitable road compositions. USGS images are reachable and mostly have recent metadata timestamps, but missing coordinates, questionable bearings, nighttime imagery and one stale camera prevent sunset qualification. NSW returns HTTP 200 responses that the existing cache rejects as non-images. Three providers were blocked before image requests because of rights, credentials or existing policy.

Recommended Phase 3.7b priority: (1) USGS coordinate/orientation validation and daylight curation, (2) NSW endpoint/placeholder investigation, (3) Digitraffic manual selection of sky-facing presets. These are conditional development priorities, not approved production providers.

## Baseline and instruction conflict

- Initial working tree was clean on `main`, HEAD **60630a2e4312638ee7dffc53eee211fce78a3772**, `chore(recovery): preserve phases 3.5–3.7 and provider discovery`. This differs from the earlier audit: the recovered work has since been committed. Nothing was reset, cleaned, committed, pushed or discarded during this task.
- `AGENTS.md` still says “Execute PHASE 1 only” and describes older mock-only scoring, a 96-camera pool and initial solar windows. The user's explicit Phase 3.7a instructions supersede that obsolete phase restriction. Current source was used for actual policies, quality functions, registry and solar windows. `AGENTS.md` was not changed.
- Actual saved discoveries: Vegagerdin **500**, Digitraffic **2116**, NSW **217**, NZTA **313**, Ontario511 **1672**, USGS **459**. These are discovered records, not validated cameras.
- Existing runtime registry: 300 Windy + 34 MeteoGalicia rows, **332 unique IDs** after deduplicating the two existing repeated MeteoGalicia IDs. Those IDs were not repaired here.
- No pre-existing source/data file was modified. No scoring, FinalScore, Hero threshold, public ranking, provider cache, discovery pool or Gold Registry was changed. No full discovery or production build was run.

## Reviewed implementation and execution safety

Existing code reused:

- [`catalogue.ts`](../lib/providers/catalogue.ts): policies, TTLs, maximum image ages, request gaps, attribution.
- [`official-webcam-provider.ts`](../lib/providers/official-webcam-provider.ts): `OfficialWebcamProvider`, `createOfficialLoader`, existing feed URLs.
- [`official-normalizers.ts`](../lib/providers/official-normalizers.ts) and [`normalize.ts`](../lib/providers/normalize.ts): normalized camera records.
- [`http-cache.ts`](../lib/providers/http-cache.ts): `providerFetch`, gzip, identification, timeouts, rate spacing, metadata validators/in-flight sharing/backoff.
- [`image-cache.ts`](../lib/providers/image-cache.ts): `createProviderImageCache`, validators/fingerprints, MIME check, streaming 8 MB bound, 96-entry maximum.
- [`camera-quality.ts`](../lib/camera-quality.ts): unchanged `analyzeCameraQualityImage`, `calculateCameraQuality`.
- [`image-viability.ts`](../lib/image-viability.ts): unchanged `analyzeImageBuffer`.
- [`coverage-optimizer.ts`](../lib/coverage-optimizer.ts): existing offline solar matrix and counts.

The original [`benchmark-providers.ts`](../scripts/benchmark-providers.ts) was reviewed **but not executed**:

1. It scans every candidate, with no sample cap.
2. Without a provider argument it starts all providers concurrently.
3. It overwrites `*-reviewed.json` and `*-benchmark.json`.
4. It checks camera enabled/scoring flags but not provider `defaultEnabled` or a freshly verified rights decision.
5. Only Digitraffic explicitly refreshes timestamps; other metadata timestamps can be inherited from old discovery data.
6. Its image-success counter conflates fetching and decoding. Neither that count nor its reliability average establishes sunset suitability.

The new [`validate-provider-samples.ts`](../scripts/validate-provider-samples.ts) is a small validation orchestrator around the existing architecture, not a replacement provider system. It:

- Restricts this run to Digitraffic, NSW and an explicit USGS HVO camera allowlist.
- Selects at most **10 distinct cameras per provider** from saved data, diversifying location, region and available direction. Images were not pre-ranked by quality; actual qualities were observed afterward. Digitraffic has no normalized optical bearings in its saved pool, so orientation diversity could not be established there.
- Makes one cached metadata refresh per provider (Digitraffic requires its existing two feeds), then fetches only sampled images. Reading a provider-wide metadata feed is not a global discovery run; no new candidate pool is written.
- Does not use `.env.local`, tokens, installation hooks or shell subprocesses.
- Allows only the existing approved HTTPS feed/image hosts; rejects credentials in URLs and HTTP redirects instead of following them to unknown destinations.
- Uses existing cache/timeouts with an additional 1.5-second delay per outgoing request. Digitraffic's existing 1.1-second spacing and identification header also remain active.
- Keeps capture metadata separate from HTTP success. Its provider-age cutoff is **60 minutes**, with up to five minutes of future-clock tolerance, matching the existing benchmark convention.
- Retains only metrics/observations in the repository. Small unmodified-content thumbnails/contact sheets are in a temporary directory for visual review, not public assets or committed image fixtures.
- Writes a new results file exclusively (`wx`) and refuses to overwrite it on a subsequent run. Saved discoveries and review files remain intact.

Node 24.21.0 was available through the local nvm installation but absent from the default command PATH. It was invoked explicitly. No dependencies were installed.

## Current rights/access review

Provider availability and terms were checked against official sources before image fetching; local `licenseVerified` flags alone were not treated as proof.

| Provider | Decision | Evidence / restriction |
| --- | --- | --- |
| Digitraffic | Permitted bounded validation | [Official terms](https://www.digitraffic.fi/en/terms-of-service/) allow CC BY 4.0 reuse with credit, licence links and modification notices. [Instructions](https://www.digitraffic.fi/en/support/instructions/) document gzip, application identification, conditional requests and a 60 requests/minute unauthenticated ceiling. No Authorization header was sent. |
| NSW | Permitted bounded validation | [Official NSW dataset](https://www.data.nsw.gov.au/data/en/dataset/2-live-traffic-cameras) lists Creative Commons Attribution and image URLs. [Official developer guide](https://opendata.transport.nsw.gov.au/sites/default/files/2023-08/Live_Traffic_Data_Developer_Guide.pdf) describes the camera-image feed. The catalogue's Transport Open Data URL returned 403 through the browser tool; the NSW Government dataset page remained accessible. No verified numeric image quota was found; 10 sequential cameras with spacing and no polling were used. |
| USGS | Permitted only for identified HVO cameras | [USGS copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) distinguishes USGS-produced material from third-party copyrighted content. [Official Kilauea webcam list](https://www.usgs.gov/volcanoes/kilauea/webcams), [HVO listings](https://www.usgs.gov/observatories/hvo/multimedia/webcams?cam=MLcam) and [official camera index](https://volcanoes.usgs.gov/cams/index.php) identify the selected HVO cameras. FAA/foreign-owner cameras were excluded; the normalizer's code-prefix heuristic was insufficient on its own. No blanket permission for all Ashcam entries is claimed. |
| Vegagerdin | **BLOCKED — rights unclear** | Existing catalogue explicitly says no camera reuse licence was located and `licenseVerified=false`. Official-source research did not establish a specific applicable image reuse grant. Public feed accessibility is insufficient to override this uncertainty. No metadata/image probe performed. |
| NZTA | **BLOCKED — existing policy** | Catalogue has `defaultEnabled=false`, opt-in restrictions and preserve-framing requirements. This task explicitly requires reporting disabled providers as blocked. No opt-in or image fetch was attempted. |
| Ontario511 | **BLOCKED — credentials/access** | Current [API documentation](https://511on.ca/developers/doc) and [camera endpoint](https://511on.ca/help/endpoint/cameras) require a registered developer key and limit calls to ten per 60 seconds. [Access agreement](https://511on.ca/developers/resources) governs use. Existing adapter has no authentication support. Old public discovery does not establish current authorization; saved image URLs were not used to bypass the key requirement. |

No messages or registration requests were sent to providers. Any later image display must preserve provider attribution and applicable notices; thumbnails here were used only for local inspection.

## Measured provider results

HTTP success below means image-endpoint HTTP 200, not valid image content. Capture timestamp availability counts successfully decoded images with refreshed provider timestamps. Blocked/not-decoded values are **unknown/N/A**, not inferred failures of the entire provider.

| Provider | Discovered | Selected / image GET attempts | HTTP success | Decoded | Capture timestamps | Fresh decoded images | Resolution | Normalized direction | Median existing cameraQualityScore |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | ---: |
| Digitraffic | 2116 | 10 / 10 | 10/10 (100%) | 10/10 | 10/10 | 10/10 | All 1280×720 | 0/10 known | **65.65** |
| NSW | 217 | 10 / 10 | 10/10 (100%) | 0/10 | Unknown | Unknown | Unknown | 10/10 known in refreshed metadata | N/A |
| USGS | 459 | 10 / 9 | 9/9 (100%) | 9/9 | 9/9 | 8/9 | 1280×720–3840×2160, also 1280×960 and 1376×768 | 10/10 numeric; all 0°, **not verified optical bearings** | **84.5** |
| Vegagerdin | 500 | 0 / 0 | N/A | N/A | N/A | N/A | N/A | Untested | N/A |
| NZTA | 313 | 0 / 0 | N/A | N/A | N/A | N/A | N/A | Untested | N/A |
| Ontario511 | 1672 | 0 / 0 | N/A | N/A | N/A | N/A | N/A | Untested | N/A |

Medians use the ordinary midpoint for even sample sizes, rather than the existing benchmark helper's lower-middle quantile. Scores themselves are the unchanged `review.quality.score` calculation, not newly calibrated scores.

Metadata HTTP results: Digitraffic **2/2**, NSW **1/1**, USGS **1/1**. All returned 200 and the existing normalizers produced the requested subset, except the inactive/absent USGS MITD view.

Main run totals: **4 metadata GETs and 29 image-endpoint GETs**, at most ten selected cameras per provider. NSW received **one additional HEAD and one bounded diagnostic GET for the same already sampled camera**; no eleventh camera was selected. The diagnostic body was limited to 1024 bytes, with no redirect or endpoint workaround.

### Digitraffic: exact sampled observations

All images were viable, all timestamps came from refreshed metadata, and image ages were **0.7–10.3 minutes**. None was in the current sunset window at observation time.

| Preset | Location | Age min | Quality | Existing skyShare / openComposition | Visual observation |
| --- | --- | ---: | ---: | --- | --- |
| C0150301 | Inkoo | 7.7 | 62.5 | .796 / .785 | Road and trees dominate; no useful open horizon |
| C1453301 | Utsjoki / Nuorgam | 1.7 | 67.6 | .999 / .947 | Downward road view; virtually no sky |
| C1260701 | Suomussalmi / Saarivaara | 1.1 | 59.9 | .996 / .348 | Road, snow and forest; little sky, high texture |
| C1055201 | Vöyri / Österö | 10.3 | 66.8 | .928 / .971 | Road/bins and forest; no useful horizon |
| C1451301 | Kolari / Pohjasenvaara | 7.5 | 65.8 | .956 / .855 | Forest road; no useful sky opening |
| C0352201 | Parikkala / Särkisalmi | 8.0 | 65.2 | .982 / .770 | Road/trees fill frame |
| C0259001 | Åland / Eckerö | 6.9 | 66.1 | .949 / .881 | Narrow top sky strip over rural road; borderline, needs a sunset-time view |
| C1453501 | Enontekiö / Kilpisjärvi | 2.3 | 65.5 | .974 / .804 | Small distant sky/landscape strip; road dominates; borderline |
| C1459302 | Savukoski / Tulppio | 9.9 | 62.9 | .750 / .875 | Low sun/glare through trees; no broad horizon |
| C1261101 | Hailuoto | 0.7 | 68.3 | .999 / 1.000 | Hazy/fogged downward road frame; sky classification misleading |

**Suitability:** zero clear sunset-ready views, two borderline composition candidates, eight poor/obscured compositions. These conclusions come from visual inspection, not the automated proxy. The existing quality heuristic marks nine of ten as sky/open-composition candidates, demonstrating that its “skyShare” is not a semantic sky measurement: pale roads, snow and fog can satisfy its brightness/colour rules. No quality function was changed.

The current normalizer receives no explicit optical bearings in this pool; road chainage/direction must not be substituted. Separate preset details or manual facing review would be required.

### NSW: failures and sample diversity

Selected locations: Rocky Point Road/Captain Cook Bridge, Tweed Heads, Echuca–Moama Bridge, Jindabyne, Tamworth, Coffs Harbour, Wagga Wagga, Bathurst, Tomago and Batemans Bay. Normalized facing directions span N, NE, E, S, SW, W and NW.

All ten image attempts failed with the existing cache error **`nsw did not return an image`**, despite HTTP 200. No image dimensions, capture freshness, viability or quality score can be assigned.

The first sampled URL was subsequently checked with HEAD and a bounded GET:

- HTTP 200, `Content-Type: text/html`, `Content-Length: 307`, server `AmazonS3`.
- `Last-Modified: Wed, 30 Aug 2023 02:26:41 GMT` describes an HTML object, **not camera capture time**.
- Body says “Page not found” and camera imagery temporarily unavailable.
- No redirect was followed; the cache's MIME guard correctly rejected the response.

The exact body/header evidence is in [`phase-3.7a-nsw-response-diagnostic.json`](phase-3.7a-nsw-response-diagnostic.json). Only that one body's contents were inspected; the other nine have the same cache rejection, not independently confirmed identical placeholder bodies. This may be a service/image-path issue; no unsupported alternative endpoint was invented.

### USGS: timestamps, bad geometry metadata, nighttime limitations

The ten-camera allowlist included Kilauea B1, KW, HP, K2, KO, KP, MITD, S1, S2 and Mauna Loa ML. F1 thermal imagery and external Ashcam owners were excluded. MITD was absent/inactive or disallowed in refreshed metadata and was not downloaded.

| Camera | Image dimensions | Metadata age min | Quality | Observation |
| --- | --- | ---: | ---: | --- |
| B1 | 3840×2160 | .1 | 93.4 | Almost black nighttime image; existing sky proxy misleading |
| KW | 3840×2160 | .2 | 85.0 | Nighttime; only sampled view with nonzero saved coordinates |
| HP | 1280×720 | 12.2 | 84.5 | Dark/noisy nighttime image |
| K2 | 3840×2160 | .2 | 93.5 | Black sky with isolated lights; not a sunset |
| KO | 1280×960 | 12.0 | 84.0 | Dark nighttime landscape |
| KP | 3840×2160 | 2.3 | 84.4 | Dark nighttime frame |
| MITD | N/A | N/A | N/A | No permitted active image in refresh; skipped |
| S1 | 1376×768 | 28311.2 | 74.2 | Metadata timestamp September 21; stale image with older embedded overlay |
| S2 | 1280×960 | 11.7 | 84.1 | Lava/glow at night, not sunset light |
| Mauna Loa ML | 3840×2160 | 1.4 | 84.5 | Dark/noisy; viability passed but sky/horizon unconfirmed |

Eight images have metadata timestamps under 60 minutes; this establishes metadata freshness, not independent verification that every capture timestamp matches pixels. Most overlays show the current HST date/time. S1's older embedded overlay reinforces the need for capture-level checks rather than relying on HTTP success.

Visual inspection took place around **02:32 HST**, so no clear sunset composition was validated. Eight of nine decoded images failed existing viability; ML passed but had skyShare .005. Daylight inspection is necessary before making permanent composition judgments.

**Critical metadata limitation:** nine of ten saved sample records have latitude/longitude `(0,0)`; KW alone has plausible Hawaii coordinates `(19.421, -155.287)`. All sample records report bearing 0°. In the entire saved USGS pool, **89/459** have `(0,0)` and **127/459** have bearing 0°. Some zero bearings can be real north-facing cameras, but these sample bearings are not validated. The normalizer's numeric range checks allow zero-coordinate placeholders and assign numeric bearings as metadata confidence. High quality scores therefore do not imply valid astronomy or orientation.

## Preliminary geographical/solar-window comparison

Used the existing `buildCoverageMatrix` with **12 representative 2026 dates × 96 quarter-hour slots = 1152 slots**. Baseline is the enabled Windy/MeteoGalicia registry deduplicated to 332 IDs; no registry/report file was rewritten. This is solar geometry only, without weather, direction visibility, historical uptime or seasonal image suitability.

Baseline strict coverage: average **11.20**, median **10**, minimum **0**, fifth percentile **4**; **261/1152** slots below eight cameras. Extended coverage: average **15.77**, minimum **1**; **862/1152** below eighteen. These fresh offline calculations are distinct from the older saved Windy-only report.

| Sample | Preliminary geometrical effect if usable | Qualification caveat |
| --- | --- | --- |
| Ten decoded Digitraffic cameras | 156 strict slots gain at least one camera; 12 previously-below-eight slots gain redundancy; zero empty strict slots filled. Nearest baseline camera distances 80–389 km. | Zero clearly suitable views; two borderline. These are potential coordinates, **not realized sunset coverage**. Nine automatic proxy passes produce the same slot counts, but manual review invalidates treating them as curated additions. |
| USGS KW only, excluding `(0,0)` placeholders | 22 strict slots gain one camera; four below-eight slots improve; zero empty strict slots filled. Nearest baseline location 184 km. | Nighttime frame, bearing unverified; not yet sunset-qualified. Other Hawaii coordinates must be verified before simulation. |
| NSW | No image-qualified addition | Discovered Australian locations have geographical potential, but none of the sampled endpoints produced a usable image. |
| Blocked providers | Not evaluated | Saved locations do not overcome rights/access restrictions. |

**Verified sunset-ready additions from this run: zero.** No full-global improvement percentage, provider-wide suitability rate, production coverage increase or validated sunset recall is claimed. Multiple nearby Hawaii views would also interact with the unchanged 25 km public dedupe. All tested plausible-coordinate decoded samples were outside the current sunset window; validation deliberately measures access/composition rather than current sunset Evidence or Beauty.

## Ranked recommendation for Phase 3.7b

1. **USGS/HVO — first conditional candidate.** Strong image availability and a useful longitude, but first correct/curate missing coordinates, verify facing/thermal status and ownership per camera, exclude stale S1, and inspect the same sample in daylight or near sunset. No broad Ashcam enrollment.
2. **NSW — endpoint recovery investigation.** Southern-hemisphere geography and explicit facing metadata are valuable. Resolve documented still-image availability and capture timestamps on the existing ten cameras before any runtime integration. Do not accept HTML placeholders or interpret their Last-Modified as capture freshness.
3. **Digitraffic — technically validated, low composition priority.** Keep existing cache/rate policy; manually identify horizon-facing presets before integration. This sample shows good API/image reliability but mostly roads. Do not select Gold cameras from qualityScore/skyShare alone.
4. **Vegagerdin — blocked pending documented image rights.** Potentially promising Iceland landscapes, but no image validation authorized under the uncertainty rule.
5. **Ontario511 — blocked pending registered access.** Obtain a developer key through official channels before adapting server-side authentication and sampling. Do not infer permission from the old successful discovery.
6. **NZTA — blocked by policy.** Requires an explicit opt-in decision and review of framing/notice obligations before a bounded validation. No policy was changed here.

Phase 3.7b should begin with verified provider metadata and curated small samples; it should not enroll all discovered records, expand Gold or retune sunset scoring automatically.

## Validation commands and preserved artifacts

After reviewing `package.json`, Vitest/ESLint configuration and existing test mocking/local fixture behavior:

```sh
PATH=/Users/scottalbers/.nvm/versions/node/v24.21.0/bin:$PATH node --import tsx scripts/validate-provider-samples.ts
PATH=/Users/scottalbers/.nvm/versions/node/v24.21.0/bin:$PATH npm run lint
PATH=/Users/scottalbers/.nvm/versions/node/v24.21.0/bin:$PATH npm test
```

- Sample runner: completed successfully, within distinct-camera bounds.
- Lint: **passed**.
- Tests: **174 passed, 19 files**. Existing tests do not certify live official-provider availability.
- Production build: not run; unnecessary for this validation/report-only scope.
- No install hooks, full discovery, full benchmark, public ranking requests or registry rebuilds were executed.
- Final checks confirmed no tracked source/data differences from recovery HEAD and `git diff --check` passed.

New artifacts:

- [`validate-provider-samples.ts`](../scripts/validate-provider-samples.ts): bounded runner using existing modules.
- [`phase-3.7a-provider-validation-results.json`](phase-3.7a-provider-validation-results.json): per-camera metrics, request statuses, timestamps and explicitly provisional automatic-proxy coverage.
- [`phase-3.7a-nsw-response-diagnostic.json`](phase-3.7a-nsw-response-diagnostic.json): bounded HTML failure observation.
- This Markdown report: rights decisions, manual observations, interpretation and recommendations.

The results JSON contains the local temporary-preview directory for traceability; no image URL credentials or environment values are included. Manual conclusions above take precedence over the intentionally labelled automated suitability proxy. Temporary previews are not durable regression fixtures and may be removed by the operating system.
