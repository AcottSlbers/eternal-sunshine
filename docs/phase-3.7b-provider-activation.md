# Phase 3.7b — Bounded provider activation

Validation date: 2026-10-11 UTC. Scope: USGS, Digitraffic and NSW only.

## Outcome and evidence limits

**VERIFIED:** 19 explicitly reviewed Digitraffic presets are enabled through the existing normalized runtime registry. USGS contributes **zero** cameras. NSW remains excluded. No discovery candidate file is imported into runtime.

**NOT YET VERIFIED:** a real Digitraffic sunset entering the normal astronomical/evidence/public-ranking pipeline. At both live ranking runs, all 19 approved Finnish views were outside the astronomical window. Adapter/image/freshness/cache behavior was tested live; admission through the normal ranking gates was tested with controlled fixtures. Under the requested strict definition, full live sunset runtime readiness remains provisional. An adapter file or an enabled registry row alone is not proof of an operational public sunset source.

| Provider | Reviewed in this phase | Image attempts | Decoded | Fresh capture metadata | Enabled in runtime | Conclusion |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| USGS | 36 | 0 | Not tested | 11 coordinate-valid records within 60 minutes | 0 | Missing coordinates, nighttime validation and one thermal camera block activation |
| Digitraffic | 38 presets | 38 full images | 38/38 | 38/38 within 60 minutes | 19 | Reviewed scenic subset enabled; first live sunset admission still unverified |
| NSW | 5 endpoints | 5 | 0/5 | Unknown; placeholder modification date is not capture time | 0 | All five returned HTML unavailable placeholders |

Two additional approved Digitraffic cameras were probed through the runtime adapter: **2/2 fresh metadata, 2/2 decodable current previews**. These are repeat observations of already reviewed cameras, not two additional validated identities. Total Digitraffic image downloads in this phase: 38 full-image curation requests plus two runtime previews. No USGS images were downloaded in this phase. The earlier Phase 3.7a USGS 9/9 decoding result and median 84.5 are historical evidence, not new daylight qualification.

All freshness claims above refer to provider-reported capture timestamps, not HTTP success. Three Digitraffic frames looked twilight-like despite fresh timestamps and daylight geometry; their pixel/capture-time correspondence remains uncertain and they were explicitly rejected.

## Repository and instructions

**VERIFIED:** branch `main`, HEAD `60630a2e4312638ee7dffc53eee211fce78a3772`. HEAD remains unchanged. No commit, push, reset, clean, installation or full discovery job was performed.

The following untracked recovery/Phase 3.7a files existed before this work and were preserved:

- `docs/phase-3.7a-provider-validation.md`
- `docs/phase-3.7a-provider-validation-results.json`
- `docs/phase-3.7a-nsw-response-diagnostic.json`
- `scripts/validate-provider-samples.ts`

`AGENTS.md` still says “Execute PHASE 1 only” and contains old mock/MVP directions. The explicit Phase 3.7b request overrides that stale phase limit. Current source already contains real providers, image scoring, Gold registry, Hero logic and Phase 3.6 calibration; none were replaced with the Phase 1 design. `AGENTS.md` was not edited. This bounded state check does not establish that historical Git recovery was complete.

## USGS metadata findings

Observed official endpoint: `https://volcview.wr.usgs.gov/ashcam-api/webcamApi/webcams`. One current metadata response contained **462** records; the saved discovery contains 459. The saved candidate file was not regenerated.

| Observed field | Meaning / normalized use |
| --- | --- |
| `webcamCode`, `webcamName` | Stable identity and display name; ID remains `usgs:<webcamCode>` |
| `latitude`, `longitude`, `elevationM` | Top-level camera location fields; no usable nested coordinate fallback was observed |
| `bearingDeg` | Explicit optical-bearing metadata; finite values in `[0,360)` map to `viewAzimuth`, confidence `metadata` |
| `vnum`, `vName` | Volcano identity/location label; never substituted for camera coordinates |
| `hasImages` | Availability signal, not a verified live-camera health guarantee |
| `newestImage.imageTimestamp` | Unix seconds, normalized to UTC capture time |
| `newestImage.isNighttimeInd` | Additional upstream night flag; daylight qualification also checks solar geometry |
| `currentImageUrl`, `currentMediumImageUrl`, `currentThumbImageUrl` | Official still-image variants |
| `externalUrl`, `faaInd` | Source/ownership review clues; aggregator hosting alone does not establish USGS image ownership |

**VERIFIED:** 25 of the 36 selected source records supplied `(0,0)`. They cannot support correct solar calculations. No related camera-coordinate field was verified that safely repairs them. The source includes Hawaii views such as `kilauea-hp-cam` with these unusable coordinates. The former normalizer admitted them because `(0,0)` passes numeric latitude/longitude bounds.

`normalizeUsgs` in [official-normalizers.ts](../lib/providers/official-normalizers.ts) now excludes this sentinel pair. It also removes the prior ownership assumption based solely on a `kilauea-` or `mauna-loa-` prefix. Only non-FAA records linked to a USGS source are eligible for USGS-origin reuse; external/unverified owners remain restricted. Missing bearing stays unknown. Actual zero-degree bearing remains zero; it is not silently converted to “unknown” or inferred from a name.

Example observed records:

- `msh-edifice`: latitude 46.27527, longitude -122.21826, bearing 164, USGS source link, `hasImages=Y`.
- `kilauea-kw-cam`: latitude 19.421, longitude -155.287, bearing 0, official HVO source link.
- `kilauea-f1-cam`: same published coordinates and bearing 0; [official HVO webcam documentation](https://www.usgs.gov/volcanoes/kilauea/webcams) identifies F1 as thermal imagery. It is excluded from visible-light sunset qualification.

**INFERENCE:** the repeated `(0,0)` values likely represent unconfigured coordinates. Numeric bearings, especially the Hawaii zero values, still need optical-direction corroboration during daylight review. No geographic location or orientation was invented to bypass this uncertainty.

### USGS curation result

[usgs-review-3.7b.json](../data/providers/usgs-review-3.7b.json) records every decision:

- 25 `rejected-no-coordinates`.
- 10 `rejected-night-only/insufficient-validation`.
- 1 `rejected-poor-horizon`: F1 thermal imagery.
- 0 accepted, 0 activated, 0 current daylight image/quality measurements.

The coordinate-valid sample was in astronomical night when examined (Mount St. Helens approximately −17° solar elevation; Hawaii approximately −50°). Downloading night images again would not resolve daylight composition. The reusable curation mode requires a fresh capture and daylight elevation at least +3° before downloading. The recorded run used review-time solar geometry; the finalized runner uses capture-time geometry when capture metadata is valid. No record was near that boundary in this run.

The selected coordinate-valid cameras concentrate around Mount St. Helens and Kīlauea; they do not yet constitute geographically distributed USGS coverage. Daylight image success, horizon suitability and current camera-quality distribution are **unknown**, not zero-quality results. [USGS copyright guidance](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) applies to USGS-created material, not every image hosted by Ashcam.

## Digitraffic selection and actual observations

Official station catalogue: `https://tie.digitraffic.fi/api/weathercam/v1/stations`; capture-time feed: `/stations/data`; targeted station details: `/stations/<stationId>`.

The current bulk catalogue contained 813 stations. Saved discovery remains 2,116 camera presets. No full rediscovery was run. The curation runner inspected **20 specifically selected stations**, including named landscape/extra presets; 19 stations supplied eligible views for a **38-preset** sample. Detailed metadata reveals names such as `Maisema`, `Merimaisema`, `Järvimaisema` and `Saanatunturi` that the bulk preset entries omit. Road-surface presets (`Tienpinta`) were excluded before image requests.

Station/preset identity remains the existing globally unique API preset ID, e.g. `digitraffic:C1453508`. The station component is derivable as `C14535`; IDs do not depend on array position or display names. No migration to a different composite spelling was needed.

**VERIFIED:** all 38 requested full images returned HTTP 200, decoded, and were **1280×720**. All had individual preset `measuredTime` values, ages **4.88–14.37 minutes** at sampling. None exposed a verified optical azimuth. `INCREASING_DIRECTION`, `DECREASING_DIRECTION`, `SPECIAL_DIRECTION`, or a destination place name are not camera bearings. All 38 retain unknown direction. No west-only rule or alignment bonus was added.

| Existing camera-quality metric | All 38 reviewed | 19 accepted |
| --- | ---: | ---: |
| Minimum | 55.1 | 64.2 |
| First quartile | 64.85 | 66.65 |
| Median | 66.65 | 67.3 |
| Third quartile | 67.6 | 67.95 |
| Maximum | 68.3 | 68.3 |

Quality was calculated by the unchanged `analyzeCameraQualityImage` / `calculateCameraQuality`. Traffic categories and their existing penalty remain intact. Acceptance did not increase `qualityWeight` or relabel traffic cameras to manufacture higher scores.

**VERIFIED manual composition decisions:**

- 19 accepted: lake, coast, mountain or open valley views across 13 stations.
- 11 rejected for road/foreground dominance.
- 5 rejected for obstructed horizon, glare or limited useful sky.
- 3 rejected for insufficient daylight/image-time validation: `C1454408`, `C1453308`, `C1458507`.

[digitraffic-review-3.7b.json](../data/providers/digitraffic-review-3.7b.json) contains exact camera IDs, names, measured timestamps, dimensions, fingerprints, existing quality components, geometry diagnostics and explicit accept/reject reasons. Manual horizon confirmation is required; there are no pending rows. Contact sheets were visually inspected, not accepted solely from a score. Thumbnails were written into a unique temporary directory outside the repository; large camera images are not committed as fixtures.

Accepted locations span latitude **61.738281–69.785258° N**, longitude **20.874249–29.11913° E**. Estimated natural-sky geometry area ranged **0.200–0.701** for accepted views. These are approximate segmentation diagnostics, not measured physical sky percentages. The separate camera-quality sky-share heuristic gave very high values even for several road-heavy rejections; it is insufficient for automatic curation. Manual visual decisions take precedence.

**INFERENCE:** this subset adds northern European scenic redundancy and seasonal twilight opportunities. Longitude concentration is narrow, and several presets share stations. No global sunset-slot improvement was simulated or claimed; existing 25 km deduplication remains responsible for nearby views.

The [Digitraffic data terms](https://www.digitraffic.fi/en/terms-of-service/) and [request instructions](https://www.digitraffic.fi/en/support/instructions/) were reviewed. Fintraffic / digitraffic.fi and CC BY 4.0 attribution are preserved. [Road-traffic documentation](https://www.digitraffic.fi/en/road-traffic/) describes the station, preset and capture-time resources used here.

## NSW endpoint diagnosis

[phase-3.7b-nsw-diagnostics.json](phase-3.7b-nsw-diagnostics.json) records five geographically varied structured-feed URLs:

| Camera | Region | Actual result |
| --- | --- | --- |
| 5 Ways, Miranda | SYD_SOUTH | HTTP 200 HTML unavailable placeholder |
| Airport Drive, Mascot | SYD_MET | HTTP 200 HTML unavailable placeholder |
| Giinagay Way, Macksville | REG_NORTH | HTTP 200 HTML unavailable placeholder |
| Echuca–Moama Bridge | REG_SOUTH | HTTP 200 HTML unavailable placeholder |
| Chifley Road, Bell | REG_WEST | HTTP 200 HTML unavailable placeholder |

Every response had `content-type: text/html`, size **307 bytes**, no redirects, and initial magic bytes `3c68746d6c3e` (`<html>`), not JPEG/PNG/GIF/WebP. Final URLs matched requested official webcam URLs. All included “Page not found” and an unavailable-camera message. Their `Last-Modified` was **2023-08-30T02:26:41Z**, a placeholder asset date, not a webcam capture timestamp. No real images, unexpected-type images or redirect cases were observed in this five-item sample.

The current feed had 250 entries versus the saved discovery's 217. Across its features, observed properties were exactly `direction`, `href`, `region`, `title`, `view`. **No alternative structured image field was exposed.** The [official developer guide](https://opendata.transport.nsw.gov.au/sites/default/files/2023-08/Live_Traffic_Data_Developer_Guide.pdf) documents `href`; the [NSW government dataset](https://www.data.nsw.gov.au/data/en/dataset/2-live-traffic-cameras) establishes the official dataset source. No website scraping or undocumented URL substitution was attempted.

**INFERENCE:** this feed's documented assets are unreliable for the sampled locations. Five failures do not establish that every NSW camera is unavailable. No reliable alternative official endpoint was verified, so NSW remains disabled in runtime.

## Runtime registration, freshness and caching

- [reviewed-provider-cameras.ts](../lib/reviewed-provider-cameras.ts) imports only the two reviewed artifacts. `approvedProviderCameras` requires explicit acceptance, decoded/fresh/daylight review, manual horizon confirmation, permitted usage policy, valid coordinates, attribution, enabled visual scoring and matching namespaced identity. It deduplicates IDs and caps USGS at 40 and Digitraffic at 50.
- [camera-registry.ts](../lib/camera-registry.ts) appends the approved subset to existing Windy/MeteoGalicia rows. Gold Registry and discovery files remain untouched.
- [official-webcam-provider.ts](../lib/providers/official-webcam-provider.ts) reuses the existing official adapter. Digitraffic requests detailed metadata only for requested stations, retaining 24-hour catalogue/detail caches and the existing 10-minute capture-time feed cache. It does not request thousands of station-detail resources.
- [ranking.ts](../lib/ranking.ts) constructs reviewed providers only when enabled rows exist and policy allows them. Local solar filtering still precedes metadata/image work. Missing metadata, inactive/restricted cameras or changed coordinates fail closed for the reviewed providers; a copied review timestamp cannot substitute for a failed current metadata refresh. Refresh replaces the persisted qualification timestamp with current capture metadata.
- The existing provider maximum capture age of 60 minutes is enforced for these new sources; missing/invalid timestamps and timestamps more than five minutes in the future are rejected. Existing Windy/MeteoGalicia freshness behavior remains unchanged.
- [cached-image-analysis.ts](../lib/providers/cached-image-analysis.ts) calls the existing viability and sunset analyzers without changing their calculations. Byte fingerprint plus phase/full solar context identifies a reusable score. Viability is reused by fingerprint. A changed solar context must be rescored, even when bytes are unchanged; this preserves astronomy-dependent evidence.
- New capture metadata forces conditional image revalidation even inside image TTL, preventing a new timestamp from being attached blindly to older cached bytes. ETag/Last-Modified validators and 304 reuse remain in [image-cache.ts](../lib/providers/image-cache.ts). Identical timestamp/bytes/context reuse both fetch and analysis results. Caches remain bounded and in memory, not shared persistently between separate CLI processes.
- Digitraffic retains `Digitraffic-User`, gzip and at least 1,100 ms between requests, below the documented 60/minute default limit. Existing provider timeouts are 15 seconds; image bodies are limited to 8 MB. Reviewed image fetches require approved HTTPS hosts and reject redirects. Metadata stale fallback/backoff stays as defined in `createFeedCache`; individual capture freshness is still checked before scoring.
- The NSW diagnostic accepts manual redirects through the existing HTTP helper, follows at most three approved-host hops and checks response size/type/magic. Normal helper requests still reject unexpected redirect responses.

No evidence threshold, beauty weight, SunsetScore formula, opportunity/FinalScore calculation, Hero threshold/hysteresis or geographic deduplication changed. Controlled regression tests confirm approved daylight/gray frames do not qualify merely because their provider was activated.

### Debug and calibration

`/dev/cameras` includes accepted reviewed cameras and displays provider/canonical ID. `/dev/ranking` includes USGS/Digitraffic counts and displays source plus stable camera ID in the full pool table. No `/dev/providers` existed and none was created.

Phase 3.6 scoring, storage key and export format remain unchanged. Its import validator now accepts `usgs` and `digitraffic` as source values; otherwise comparisons exported for newly scored providers would be discarded on re-import. This is provider-format compatibility, not calibration or scorer tuning.

### Attribution verification

Controlled server-rendered tests exercise both the actual Hero and card components using an approved Digitraffic camera: Fintraffic / digitraffic.fi, CC BY 4.0 and its license link render; unrelated Windy/USGS branding does not. Live adapter probes returned the same normalized attribution. `toPublicRanking` also retains it through a fixture admitted by the normal ranking gates. No USGS camera is public, so no live public USGS attribution claim is made. The existing Windy public result continues to use its own source attribution.

## Live runtime results

[phase-3.7b-runtime-results.json](phase-3.7b-runtime-results.json) records the first capped current-time run; [phase-3.7b-runtime-cache-probe.json](phase-3.7b-runtime-cache-probe.json) records the second run and two adapter probes at **2026-10-11T12:57:06.982Z**.

| Loaded source | Registry rows | Current astronomical candidates | Images analyzed in ranking | Public ranking |
| --- | ---: | ---: | ---: | ---: |
| Windy | 300 | 15 | 7 | 1 |
| MeteoGalicia | 34 | 0 | 0 | 0 |
| USGS | 0 | 0 | 0 | 0 |
| Digitraffic reviewed | 19 | 0 | 0 | 0 |

Both ranking runs loaded **353 rows**, evaluated 15 astronomical candidates, rejected six for evidence and eight for other reasons, and returned one existing Windy camera (`1575976064`). There were zero featured-threshold candidates and zero new-provider public results. Existing Hero/fallback behavior was retained. The old registry already contained two repeated MeteoGalicia IDs: the combined registry therefore has 351 unique IDs, not 353 unique cameras. That unrelated baseline issue was not refactored.

The two actual runtime probes used `digitraffic:C1451607` and `digitraffic:C1453508`. Fresh preset captures were respectively 7.83 and 8.48 minutes old. Previews decoded at **384×216**. Current solar elevations were +7.08° and +9.52°, outside the sunset window. Their unchanged analyzer returned evidence 0 and beauty 0. They were not injected into astronomical candidates or public results.

Probe process HTTP observations: **six Digitraffic requests, six successes, zero errors** (two bulk feeds, two targeted station-detail resources, two previews). Repeating each same-context image analysis required **zero** new HTTP requests and produced identical results. Both repeats recorded image-cache hits. ETag/304 handling, changed-capture revalidation and fingerprint/context analysis reuse were additionally tested with controlled responses; no real 304 response was observed in these short live probes.

The diagnostic's `freshKnownImages=19` includes recent persisted qualification metadata for off-window registry rows. It must not be read as 19 fresh runtime metadata requests; only two reviewed identities received the later live adapter probe.

## Validation and safety

Reviewed `package.json` commands, Vitest/Next configuration and diagnostic runner behavior before executing. No unknown install hook, arbitrary project shell command or new dependency was executed. Reports omit credentials, full environment files and Windy signed image URLs. The runtime validation loads `.env.local` server-side quietly for the established Windy adapter; no secret is printed or persisted.

| Command | Final result |
| --- | --- |
| `npm test` | PASS: 193 tests, 21 files |
| `npm run lint` | PASS |
| `npm run build -- --webpack` | PASS, including TypeScript |
| `git diff --check` | PASS |
| Bounded live runtime CLI | PASS: 15 candidates under explicit 50-candidate cap |

An initial build identified implicit callback types in the loader after the targeted-detail change; explicit loader/map types fixed that integration error. No unrelated refactoring was applied. Next regenerated `next-env.d.ts`; its exact previously recorded baseline bytes were restored after the build, so the generated file is not part of the final diff. The initial whitespace check on those generated CRLF changes failed; the final check passes.

Additional regression coverage: coordinate sentinel exclusion; unknown/explicit direction handling; review gates and caps; ETag/304 cache reuse; changed timestamp revalidation; changed-context rescoring; provider failure/missing/inactive/stale/future/changed-coordinate isolation; no off-window requests; unchanged evidence admission; actual public attribution rendering. Existing scorer/real-image regression fixtures passed unchanged.

Reproduction commands (Node must be on PATH; use new output filenames):

```sh
npm test
npm run lint
npm run build -- --webpack
git diff --check
node --import tsx scripts/curate-official-cameras.ts usgs --output=data/providers/usgs-review-NEW.json
node --import tsx scripts/curate-official-cameras.ts digitraffic --output=data/providers/digitraffic-review-NEW.json
node --import tsx scripts/diagnose-nsw-endpoints.ts --output=docs/phase-3.7b-nsw-NEW.json
node --import tsx scripts/validate-reviewed-runtime.ts --probe-reviewed --output=docs/phase-3.7b-runtime-NEW.json
```

The curation runner refuses an existing output, caps sampling at 40 cameras, and never auto-promotes a review. USGS must be run during camera-local daylight; it is expected to skip night captures. Metadata snapshots from this run were reused from a unique temporary directory where available. New full-resolution images are not stored in the project. A production build normally regenerates `next-env.d.ts`; check its generated diff before treating it as an intentional source change.

## Exact files added or modified

Added in Phase 3.7b:

- `data/providers/usgs-review-3.7b.json`
- `data/providers/digitraffic-review-3.7b.json`
- `types/provider-review.ts`
- `lib/reviewed-provider-cameras.ts`
- `lib/providers/cached-image-analysis.ts`
- `scripts/curate-official-cameras.ts`
- `scripts/diagnose-nsw-endpoints.ts`
- `scripts/validate-reviewed-runtime.ts`
- `tests/reviewed-providers.test.ts`
- `tests/reviewed-provider-ranking.test.ts`
- `docs/phase-3.7b-nsw-diagnostics.json`
- `docs/phase-3.7b-runtime-results.json`
- `docs/phase-3.7b-runtime-cache-probe.json`
- `docs/phase-3.7b-provider-activation.md`

Modified:

- `lib/providers/official-normalizers.ts`
- `lib/providers/official-webcam-provider.ts`
- `lib/providers/http-cache.ts`
- `lib/providers/image-cache.ts`
- `lib/camera-registry.ts`
- `lib/ranking.ts`
- `lib/calibration.ts`
- `types/ranking.ts`
- `app/dev/cameras/page.tsx`
- `components/DebugPanel.tsx`

Protected scoring/Hero modules, Gold Registry, original provider discoveries, package/lock files and prior recovery/Phase 3.7a artifacts were not modified. All new work remains uncommitted.

## Recommended next step

1. Observe the 19 enabled Digitraffic views during an actual current sunset window through the normal ranking CLI or `/dev/ranking`; record astronomical, evidence and public admission outcomes without threshold changes. Repeat the three ambiguous image/time pairs before reconsidering them. This closes the remaining live-readiness gap.
2. Run the existing bounded USGS mode during daylight at Mount St. Helens, then HVO. Keep `(0,0)`, thermal and unverified-owner records rejected; verify open horizons and numeric bearings before approving any runtime rows. Do not substitute volcano coordinates or activate the whole catalogue.
3. Leave NSW disabled pending a corrected official structured endpoint or documented provider resolution. The five current placeholders do not justify URL guessing or scraping.

Copyable state: Phase 3.7b enables 19 manually reviewed Digitraffic scenic presets through the existing registry; USGS reviewed 36/activated 0 (25 unusable coordinates, 10 nighttime-only, 1 thermal); NSW 5/5 HTML placeholders, disabled. Digitraffic full-image curation decoded 38/38 with fresh provider timestamps, median quality 66.65; accepted subset median 67.3. Two later runtime previews decoded/fresh 2/2, repeated requests hit cache. Current normal ranking has zero Digitraffic astronomical/public results, so first live sunset admission is still unverified. Scoring/Hero/Gold unchanged. Tests 193/21, lint, webpack build and diff check pass. Main HEAD 60630a2, work uncommitted; recovery and Phase 3.7a artifacts preserved.
