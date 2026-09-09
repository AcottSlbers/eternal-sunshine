# Eternal Sunshine

Eternal Sunshine keeps a worldwide webcam registry, calculates sunset opportunity locally, and requests fresh Windy / MeteoGalicia metadata and thumbnails only for current astronomical candidates.

## Setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
```

Copy `.env.example` to `.env.local` and add a Windy Webcams API V3 key:

```text
WINDY_API_KEY=your_key_here
```

The key is used only in server code and CLI discovery. `.env.local` is ignored by Git. Do not use a `NEXT_PUBLIC_` variable.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). JSON diagnostics are available at [http://localhost:3000/api/ranking](http://localhost:3000/api/ranking).

The browser shows the user's local time, while astronomy continues to use absolute timestamps. Camera local time and daylight-saving rules come from `tz-lookup` plus `Intl.DateTimeFormat`.

## Camera discovery

```bash
npm run discover-cameras
```

Discovery makes one bounded request for each of 24 longitude buckets and deliberately keeps the full normalized candidate pool. It does not overwrite the runtime registry.

- `data/camera-candidates.json` is the full normalized and scored discovery output for review.
- `data/cameras-reviewed.json` adds deterministic quality and seasonal coverage metrics.
- `data/cameras.json` is the optimized Gold Registry used at runtime.
- `data/coverage-report.json` powers the development dashboard and size comparison.

Existing manual `enabled`, `manualQualityOverride`, `manualViewAzimuth`, `manualDirectionConfidence`, `permanentlyRejected`, and `notes` values are preserved. Windy image URLs are short-lived, so only current runtime candidates are refreshed.

## Quality and coverage registry build

After discovery, build the reviewed and Gold registries manually:

```bash
npm run build-camera-registry
```

This command downloads each candidate thumbnail once when it is not already cached in the review file, analyzes simple composition metrics with `sharp`, simulates 12 representative dates in 15-minute UTC slots without API calls, and performs deterministic greedy coverage selection. Subsequent runs reuse image analysis when the source timestamp is unchanged.

For a completely network-free rebuild using cached image metrics:

```bash
npm run build-camera-registry:offline
```

The optimizer prioritizes under-covered Strict and Extended slots, then camera quality and geographic diversity. Cameras below the configured quality floor or marked `permanentlyRejected` cannot enter the Gold Registry. Current comparison sizes are 192, 250, 300, and 400; the configured Gold output contains 300 cameras.

To explicitly build another reported size, for example 400 cameras:

```bash
npm run build-camera-registry -- --size=400
```

Open [http://localhost:3000/dev/coverage](http://localhost:3000/dev/coverage) for registry totals, quality, size comparisons, seasonal coverage, worst slots, and possible gap fillers.

## Adaptive sunset selection

UTC timestamp and camera coordinates feed `suncalc`. Sunrise locations are excluded by comparing current elevation with elevation ten minutes later. Diagnostics expose the trend and degrees per minute; there is no minimum descent rate that would exclude slow polar sunsets.

1. Strict window: -4.5° through +1.5°.
2. If fewer than eight visible sunsets remain after analysis, extended afterglow: -6° through +2.5°.
3. Known camera direction is aligned with normalized solar azimuth.
4. Stale images older than 12 hours are rejected.
5. Remaining candidate images alone are fetched once, checked for viability, and resized to at most 256×144 for deterministic sunset analysis.
6. Visual scoring separates sunset evidence from beauty. Evidence comes from sunset-relevant sky/horizon color, glow, spatial concentration, chromatic separation, and astronomical plausibility.
7. Beauty can enhance a credible sunset, while an evidence gate prevents generic contrast, texture, or color diversity from creating a high score.
8. Final ranking lightly applies Opportunity as a reliability multiplier; Opportunity cannot rescue a low visual SunsetScore.
9. The visible sunset gate runs after image analysis: both evidence and visual sunset score must reach 20 for public cards. The hero additionally requires both scores to reach 30. All four thresholds and the empty-state copy are in `lib/config.ts`.

An astronomical candidate is geometrically near sunset and descending. A visible sunset also passes image viability and the visual thresholds. A featured sunset meets the higher hero thresholds. The public `results` array contains only visible sunsets sorted by `finalScore`; `featuredCameraId` may be null even when some marginal twilight cards remain.

Rejected astronomical candidates retain scores, reasons, and solar trends in `candidateDiagnostics` and the developer panel. Failed or missing image analysis cannot pass the gate. If no camera qualifies, the page shows “Searching for the next great sunset…”. The alignment curve now rates a 68° difference at approximately 30/100; unknown direction retains its 65/100 fallback, and only differences above 120° are hard rejected.

Runtime logs and the diagnostic command report astronomical candidates evaluated, successfully analyzed images, visible sunsets, evidence rejections, other rejections, and hero-eligible candidates. `astronomical = visibleSunsets + rejectedEvidence + rejectedOther`; `imagesAnalyzed` can be smaller because stale, away-facing, or broken cameras may not yield an analysis. Extended candidates are evaluated only when needed.

Unknown direction and unavailable viability checks remain isolated per camera. Blue or cloudy twilight is not rejected merely for lacking warm colors, but it only receives a visual score when the image contains sunset evidence.

To print the current real candidate distribution and every score:

```bash
npm run diagnose-sunset-scores
```

## Public diversity and hero stability (Phase 3.2)

All Phase 3.1 visual gates and scoring remain unchanged. Visible candidates are sorted by `finalScore`, then opportunity, then camera ID for deterministic ties. A greedy geographic pass keeps the strongest camera and suppresses lower-ranked cameras within 25 km of an already retained camera. It uses great-circle distance, not shared region or location names, and does not transitively merge chains of locations. The registry is never edited.

`candidateDiagnostics` retains every evaluated camera, including suppressed scores and a separate `suppression` reason, distance, and winning camera ID. `visibleSunsets` counts passing cameras before dedupe; `publicRanked` counts public cards; `suppressedNearby` is their difference. `scoreGapToSecond` compares the first two public cards' final scores (null if fewer than two).

The hero is selected independently from fresh featured candidates **before** card dedupe. A currently qualified hero stays until a challenger gains at least 3 final-score points. Every refresh revalidates it using the latest candidate data; disappearance, stale/unknown image freshness, invalid analysis, or failed featured thresholds trigger immediate reselection. The existing 12-hour freshness limit applies. No score is boosted. Only a camera ID and evaluation timestamp are retained in server-process memory; restarting the server resets the choice. Separate server processes do not share this state, and a standalone diagnostic command starts with no previous hero.

`featuredSunset` supplies the hero independently of `results`. During hysteresis it can remain on screen even when a slightly stronger nearby camera takes the public card slot. The debug panel explains the hero decision. Public cards remain geographically deduplicated and score-sorted.

Radius, hero switch gain, and presentation-only Sunset Strength thresholds are in `lib/config.ts`. Strength uses the unchanged visual `sunsetScore`: below 20 not visible, 20 subtle, 40 good, 60 strong, 80 spectacular.

`npm run diagnose-sunset-scores` reports both rankings from the **same** image evaluation, the pre-dedupe visible score distribution, counts, hero decision, public top-two gap, and suppressed cameras. See `docs/phase-3.2-evaluation.md` for the real-data verification snapshot and its limitations.

## Multi-provider registry and sky geometry (Phase 3.3)

```bash
npm run discover-meteogalicia
```

This imports the official MeteoGalicia JSON service into `data/meteogalicia-cameras.json` without Windy requests or image downloads. `lib/camera-registry.ts` combines it with the existing Windy Gold registry at runtime. Reimport preserves manual direction, quality, enabled/rejected flags and notes; independent Windy registry builds do not overwrite the regional file. No MeteoGalicia key is required. `/dev/cameras` includes both sources; `/dev/coverage` continues to describe the existing Windy optimizer output, not a newly simulated combined pool.

MeteoGalicia IDs use `meteogalicia:<identificador>`. Its adapter normalizes municipality, province, full image, mini preview, UTC `imageUpdatedAt` and source/license attribution. Direction stays unknown unless curated. The mini is used for analysis (still resized to at most 256×144); the normal image is used for display. No images are stored permanently. Imported camera quality uses the existing metadata-based evaluator, with no provider bonus; missing resolution/framing measurements remain unknown.

Only locally relevant astronomical candidates trigger a metadata refresh. One shared in-memory promise and five-minute cache serve all MeteoGalicia cameras in that server process, including concurrent requests. Expired-cache refresh failures and missing/invalid timestamps reject affected cameras without breaking Windy. The existing 12-hour image freshness limit remains unchanged. Separate processes have separate caches.

The live JSON returns timestamps without offsets. They are explicitly interpreted as `Europe/Madrid` wall time through `Intl`, including DST, then normalized to UTC. This is a regional interpretation supported by the observed response, **not a timezone guarantee in the field documentation**. Explicit offsets/Z are honored, nonexistent spring times are rejected, and ambiguous autumn times use the older instant conservatively. Metadata can lag the image; HTTP download time never replaces capture time. See the [observed service response and evaluation](docs/phase-3.3-evaluation.md).

Provider-specific attribution accompanies the Hero and cards, including MeteoGalicia / Xunta de Galicia and its CC BY-SA 4.0 license link. Windy cameras retain Windy attribution and live playback.

Scoring now estimates a broad sky/terrain boundary from row luminance, color and texture transitions, with local ridgeline adjustments. Low confidence falls back to the previous 70% sky boundary. Sky continuity, connected sunset-color components, horizontal extent, validated glow and foreground leakage multiply the existing color evidence. A localized intense warm glow can support a real sunset even when roofs occupy much of the foreground. Generic contrast/texture remain beauty enhancements; visibility thresholds, final-score formula, dedupe and hero hysteresis are unchanged.

`/dev/ranking`, `/api/ranking` and `npm run diagnose-sunset-scores` expose source counts and all metrics. `estimatedHorizonY` and the four `*Ratio` metrics use 0–1; confidence, geometry and glow scores use 0–100. `skySunsetColorRatio` describes upper sky; `horizonSunsetColorRatio` describes lower sky above the estimated boundary. Leakage is foreground sunset-colored pixel count divided by all sunset-colored pixels, not a ratio of regional percentages.

This is not semantic segmentation: layered clouds, reflections, roofs at a skyline and horizons outside the searched 20–87% image-height range remain difficult. Confidence/fallback metrics make these errors inspectable rather than hiding them with higher visibility thresholds.

## Validation commands

```bash
npm test
npm run lint
npm run build
git diff --check
```

Tests cover window boundaries, phase scores, solar azimuth, sunrise exclusion, camera alignment and wraparound, coordinate-to-IANA timezone lookup, DST, image checks, explicit sunset/non-sunset fixtures, score ordering and gating, quality overrides, seasonal coverage, gap contribution, minimum quality, permanent rejection, deterministic optimization, and 192/250/300/400-camera prefixes.

## Public experience (Phase 4)

The `/` route is an image-first product view: a cinematic current sunset, a geographically deduplicated visual ranking, calm empty/error/loading states, and a small About/attribution footer. Technical scoring remains available through `/api/ranking` and the existing development routes, but it is neither rendered nor serialized into the public page payload.

The browser refreshes `/api/public-ranking` every ten minutes only while the tab is visible. A manual Refresh button uses that same endpoint. The endpoint invokes the unchanged safe ranking pipeline, so local solar filtering still happens before bounded Windy metadata and image requests. Refresh requests cannot overlap. There is no direct browser-to-Windy API request and the API key remains server-only.

Ranking cards select a large local view without changing backend order or Hero hysteresis. Live Windy iframes are created only after an explicit Watch live click; otherwise the current snapshot stays in place. Provider and Windy fallback links retain external-link safety attributes. Native `<img>` elements intentionally load short-lived Windy preview URLs directly rather than routing them through the Next image optimization cache.

The public response type lives in `types/public-ranking.ts`; `/api/public-ranking` omits final score, evidence, opportunity, image metrics, diagnostics, and provider request counters. `/api/ranking`, `/dev/cameras`, `/dev/coverage`, and `npm run diagnose-sunset-scores` retain their full debugging information.

## Local calibration harness (Phase 3.4)

Start `npm run dev` and open [http://localhost:3000/dev/calibration](http://localhost:3000/dev/calibration). In production this route invokes Next's not-found boundary before fetching data; it never renders the workbench. With the app's streamed loading boundary the HTTP status can still be 200, but the response is the not-found page, not calibration data. In development it runs the existing scorer once on page load with an isolated hero selector, so inspection does not update the public hero's remembered state. There is no polling: reload manually for a new snapshot using the existing candidate/provider pipeline.

The page shows **all analyzed astronomical candidates**, including visual rejections and nearby-suppressed cameras, with uncropped previews, provider attribution, all scores, solar phase, visibility/rejection reasons and every image metric. Cameras rejected before analysis have no scored image to compare and are excluded. Provider counts include Windy and MeteoGalicia even when one has zero current candidates. Sort locally by FinalScore, SunsetScore, Evidence or provider, then choose two different cameras for side-by-side comparison. Neither selection nor feedback changes ranking.

Feedback lives solely in this browser's `localStorage` under `eternal-sunshine.calibration.v1`. Format: `{ "version": 1, "comparisons": [...] }`; each comparison contains evaluation `timestamp`, `rankingTimestamp`, `a` and `b` snapshots and `choice` (`a`, `b`, `equal`, `neither`). Each snapshot contains camera ID, provider, location, image timestamp, Evidence/Beauty/SunsetScore/FinalScore, phase/elevation/stage, visibility/reason and all metrics. **No image bytes or image URLs are stored or exported.** Export local JSON to retain a portable backup. Clearing browser data deletes local evaluations; different browsers/origins have separate histories. Invalid storage disables saving rather than silently overwriting existing data. Storage quota failures are shown explicitly. No feedback endpoint, database, external submission or automated weight adjustment exists.

Rejudging the same unordered pair within one ranking snapshot replaces its previous choice; later snapshots are separate comparisons. Agreement is the fraction of strict A/B preferences whose preferred image has the higher SunsetScore. Equal/neither judgments are excluded; score ties do not match a strict preference. No eligible preferences shows N/A. False positives count unique visible/featured camera frames explicitly labeled “neither is a sunset”, deduplicated by provider, ID and image timestamp (ranking timestamp if image time is unavailable). Preferring A does not assert B is a non-sunset. The separate neither count counts pair judgments, not images.

The harness stores measurements, not reproducible image archives. Third-party preview URLs can update or expire after scoring, so verify the displayed image timestamp before judging and skip pairs with unavailable images. The existing scorer, thresholds, integrations, coverage optimizer, dedupe, live playback and normal `/` page are unchanged.

## Not implemented yet

There is no machine learning, weather enrichment, database, authentication, queue, or deployment. The visual scorer is deterministic and intentionally analyzes current astronomical candidates only.
