# Phase 3.6 — Credible sunsets, visible Hero fallback, and Hero layout

Evaluated on 2026-09-11 with live provider calls and captured image regression tests. Full before/after counts, all analyzed rejections, top-ten rejections, image ages, solar phase/elevation, component metrics and decision reasons are in [phase-3.6-diagnostics.json](phase-3.6-diagnostics.json). No signed image URLs or credentials are included.

## 1. Where the empty page originated

The **17:51:25 UTC baseline** contained 334 registry cameras, 14 enabled cameras inside the extended elevation window, and 12 with a descending sun. All twelve had recent known timestamps. Two cameras pointed away from the sun; ten images were downloaded, analyzed and viable. **All ten failed Evidence**. There were zero visible/Featured/public sunsets.

The highest rejected analyzed image was Thun (Evidence 9.9, Beauty 0.1, SunsetScore 7.0, FinalScore 6.9); Łeba followed at 1.9 SunsetScore. The other eight analyzed images scored zero, including Corneliano's visibly illuminated evening horizon. The JSON includes all ten records and the complete top ten, with provider, location, reason, phase and age.

Thus the empty current ranking was caused by detection, not lack of astronomical candidates, image staleness or viability. A separate presentation defect also existed: `createHeroSelector` considered only Featured cameras. Earlier Marathia snapshots already demonstrated that a credible visible sunset could exist without a Hero. Both defects are addressed.

## 2. Old and new credible-sunset decisions

The global visible thresholds remain Evidence ≥20 and SunsetScore ≥20. Featured thresholds and the Hero switch gain of 3 are unchanged.

Previously one conservative chromatic Evidence calculation controlled admission. Now `measureEvidencePaths` evaluates five independent explanations, and **Evidence is their maximum**, without an additive corroboration bonus or batch normalization. `isCredibleSunset` returns a boolean, primary path and explanatory reason. Runtime results include only true decisions, before unchanged FinalScore sorting and geographic dedupe. The public serializer also excludes false decisions.

Standard admission requires valid descending astronomy, an analyzed viable image, finite scores, Evidence ≥20 and SunsetScore ≥20. Runtime metadata/direction checks still precede image analysis. Missing capture timestamps are now rejected consistently for Windy as well as MeteoGalicia, so a supposedly visible camera cannot later be ineligible for every fresh Hero slot. The existing 12-hour freshness limit is unchanged.

A strict luminous alternative may admit a narrowly attenuated scene while leaving its numeric Evidence below 20. It requires **all** of:

- luminous path ≥15;
- independently validated horizon luminance ≥65;
- alternative sky geometry ≥65;
- sky confidence ≥75;
- density-based foreground leakage ≤0.7;
- coherent horizon width ≥35;
- natural sky support ≥90;
- Beauty ≥25 and SunsetScore ≥20;
- the same descending-sun, image viability and runtime freshness/direction prerequisites.

The alternative is tested with the real Parentis frame and failures of individual safeguards. It is not a global threshold reduction. `highConfidenceAlternatives` reports admissions that use it separately from standard Evidence passes.

## 3. Evidence formulas and masks

All calculations operate on the existing maximum 256×144 decoded image. Let `clamp` mean 0–1 clamping. The original dynamic horizon detector is unchanged. Specialized paths may extend a column's sky boundary downward by at most 12% of image height, only while connected pixels remain bright (luminance ≥0.5), low saturation (≤0.28), non-green and locally smooth (neighbor luminance differences ≤0.12). A dark edge, saturated terrain or texture stops extension. The old chromatic and Phase 3.5 Beauty masks remain unchanged.

Specialized color support includes warm pixels with red−blue >0.025 and green above blue, or pink/lavender pixels with both red and blue above green. Minimum saturation is 0.055 and luminance 0.28. These relaxed colors **do not** generate Evidence without connected sky geometry and a coherent vertical transition.

Sixteen sky-relative columns each compare upper 55% and lower 45% of the sky:

- `coherence = clamp(min(columnColorShare, strongestAdjacentColorShare) / 0.12)`.
- `transition = clamp((lowerMean(red−blue) − upperMean(red−blue) − 0.035) / 0.18)`.
- Four coherent columns provide full spatial support; a narrow horizontal band need not cover a large fraction of the whole image.
- `naturalSkySupport = clamp((meanSkyLuminance − 0.18) / 0.16)`.
- `astronomy = 0.65 + 0.35 × phase/100`, or zero for supplied non-descending/out-of-window astronomy.
- Common support multiplies sky confidence, connected color geometry and natural sky support.
- Foreground protection compares color density per sky/ground pixel, rather than letting a large foreground overwhelm a small visible sky solely through area. `densityLeakage = groundDensity / (groundDensity + skyDensity)`. The original count-based leakage remains in diagnostics.
- Foreground support is `clamp((0.8 − max(densityLeakage, countLeakage × (1−geometry))) / 0.5)`.

The paths are:

| Path | Formula / required visual explanation |
| --- | --- |
| Chromatic | Original Phase 3.3 chromatic Evidence × natural sky support; zero for invalid supplied sunset astronomy. The original value remains as `chromaticColorEvidence`. |
| Pastel | Sum of column `coherence × transition × clamp(pastelShare/0.25)`; pastel saturation ≤0.55. |
| Luminous horizon | Sum of `coherence × transition × clamp((lower−upper luminance−0.035)/0.22)`. Gray brightness alone cannot pass. |
| Twilight | Sum of `coherence × transition × clamp(upperBlueShare/0.3) × clamp(lowerPinkPurpleShare/0.15)`. |
| Solar glow | A localized high-luminance peak with lower-sky color, adjacent glow and a brightening transition, at the projected horizontal solar position. No peak, wrong projection or missing camera calibration yields zero. |

For pastel/luminous/twilight: divide the sum by four and clamp, multiply spatial/common/foreground support, scale to 100, cap at 65, then apply astronomy. These paths express credible detection without asserting exceptional beauty. The solar path uses its localized peak strength and the same protections, up to 100.

A luminous sky may coexist with warm reflections/foreground. Only when density leakage is below 0.75 can the luminous path use `max(foregroundSupport, 0.5 × verifiedLuminousSky²)`. Here verified luminance already requires color transition, coherence, brightening and sky geometry. This recovers the historical North Cape frame without rescuing Selfoss-like terrain. Pale-ground adversarial fixtures explicitly test the exception.

Solar projection requires a supplied camera azimuth and calibrated horizontal field of view. The current registry lacks field of view, so **the live solar-glow path remains zero**. The implementation is tested with calibrated synthetic inputs; it does not invent a field of view or claim precise solar localization from unknown camera optics. North Cape is recognized through luminous-horizon Evidence instead.

## 4. Beauty and calibration feedback

Phase 3.5 weights and exposure/darkness penalties remain. For an image admitted through luminous recovery that the original chromatic gate missed, the same glow and width Beauty slots may use validated luminous-sky measurements instead of empty high-saturation measurements. This applies only after standard/specialized visual support qualifies; ordinary terrain cannot activate Beauty through composition alone. Marathia's successful Beauty remains **50.7**.

The user supplied `sunset-calibration.json` with three comparisons from **18:09:46 UTC**. It validates with the existing version-1 parser. The downloaded file, browser localStorage, saved comparison schema and existing records are not modified.

| Human preference | Recorded scores | Observation |
| --- | --- | --- |
| Oslo > Finse | 0 vs 0 | Tie in the scorer; both rejected. A relative preference does not establish that either image is a sunset. |
| North Cape > London | 0 vs 7.3 | Reversed ordering of rejected images; the later cloudy North Cape frame differs from the recovered historical sunset. |
| Parentis > Corneliano | 13.6 vs 21.6 | Real luminous horizon was attenuated below Evidence 20 and its Beauty was suppressed. |

Baseline preference agreement was **0/3**, including one score tie. None were “neither” judgments, so the file supplies no explicit false-positive labels. Three comparisons are not a population accuracy estimate.

The captured Parentis frame matches the user's image timestamp. At the recorded phase 65.3 it now retains **Evidence 18.5**, obtains Beauty **36.5**, SunsetScore **33.8**, and passes the strict luminous alternative. Its numeric Evidence is not inflated. The exact Corneliano frame from that pair is unavailable; the complete original pair is not claimed as replayed. The two remaining relative preferences between rejected images remain unresolved.

## 5. Real regression results

Small original previews and attribution are in [tests/fixtures/real](../tests/fixtures/real/README.md). These are test-only captures, never runtime substitutes.

| Frame / control | Before SunsetScore | After SunsetScore | Result |
| --- | ---: | ---: | --- |
| Historical North Cape, 16:55:20 UTC | 0 | 46.1 | Evidence 30.8 via luminous horizon; Beauty 48.8 |
| Historical Marathia, 16:54:56 UTC | 46.7 (Phase 3.5) | 50.9 | Original chromatic Evidence 24.3 preserved; combined Evidence 52.3; Beauty unchanged at 50.7 |
| Corneliano baseline frame | 0 | 22.4 | Credible subtle pastel sky over buildings |
| Parentis at the feedback's recorded phase | 13.6 | 33.8 | Strict alternative, Evidence still 18.5 |
| Berlin artificial lights, identical later frame | 31.2 | 0.2 | Inherited chromatic false positive found during live inspection and fixed |
| Selfoss-like synthetic | 0 | 0 | Rejected |
| Snow / Law-Racoviță analogue | 0 | 0 | Rejected; original Law-Racoviță image unavailable |

North Cape was originally rejected because the high-saturation sky color fraction was tiny, count-based leakage was 0.846, geometry for those colors was 30.6 and the foreground penalty was 13.9. The new low-chroma mask finds a coherent brightening sky region. No camera IDs or locations enter scoring logic.

The initial post-change live run unexpectedly admitted Berlin at 31.2 through the inherited chromatic path. Manual preview inspection showed city lighting and a dark sky, not a sunset. The new natural-sky guard reduces the raw chromatic Evidence of 20.6 to 0.3 and rejects it. This is now a real negative fixture.

Final synthetic negative range is **0–5** across fourteen controls; the maximum is newly tested pale foreground (previous chromatic calculation: 0). It remains rejected, and its increase is recorded rather than hidden. Ordinary colorful landscape is 4; Selfoss, snow, gray harbor/clouds, roads, night, placeholder, yellow field and the streetlight fixture are zero. Synthetic positive minimum is **44.5** across twelve positive fixtures. Including captured positives, the minimum is **22.4** (Corneliano). Saturated cloud sunset 83.1 > broad golden clouds 79.3 > pastel 54.9.

Original Cape Town, Lajes do Pico and Law-Racoviță frames remain unavailable. Golden, hazy and snow analogues are not presented as original real-world validation.

## 6. Current live pipeline and public ranking

Final live run: **2026-09-11 18:21:23 UTC**. Registry remains 300 Windy +34 MeteoGalicia cameras. This time window had no evaluated MeteoGalicia candidates.

| Stage / observation | Before 17:51:25 | After 18:21:23 |
| --- | ---: | ---: |
| Registry | 334 | 334 |
| Enabled cameras inside extended elevation window | 14 | 29 |
| Descending sun | 12 | 11 |
| Evaluated | 12 | 11 |
| Direction passed | 10 | 8 |
| Fresh metadata after direction filter | 10 | 8 |
| Images analyzed | 10 | 8 |
| Image viable | 10 | 8 |
| Standard Evidence passed | 0 | 3 |
| Standard SunsetScore passed | 0 | 3 |
| High-confidence alternatives | 0 | 0 |
| Credible / visible sunsets | 0 | 3 |
| Featured sunsets | 0 | 2 |
| Public ranked | 0 | 3 |
| Hero selected | 0 | 1 |

Counts change with time and source images; the live rows are not an identical-frame A/B comparison. Known fresh timestamps across *all evaluated* cameras were 12 before and 10 after. One late-run camera had stale/unknown metadata and was also rejected for direction; it must not be counted as a second lost image. JSON `astronomical` counts the elevation window before the descending-sun check; legacy `ranking.diagnostics.astronomical` still means candidates actually evaluated. No metric silently changes the old field's meaning.

All credible candidates, sorted by FinalScore:

| Rank | Provider / location | Evidence | Beauty | SunsetScore | FinalScore | Primary path | Strength |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1 | Windy / Tarifa, Playa Los Lances Norte | 48.5 | 57.2 | 55.9 | 52.3 | pastel | good |
| 2 | Windy / Parentis-en-Born, Port du Piaou | 21.0 | 36.5 | 34.2 | 33.7 | luminous-horizon | subtle |
| 3 | Windy / Burntisland / Lochgelly Fife | 43.5 | 32.3 | 33.9 | 32.4 | pastel | subtle |

Tarifa is the Hero. Its preview was manually inspected: a broad peach/gold sky over the sea with a dark beach foreground. Burntisland's preview also shows a faint warm horizon/afterglow behind a tree. The real public response was checked: Hero Tarifa, `good`, score 55.9, three cards. A prior post-fix run at 18:05:50 had one visible Corneliano, zero Featured, and correctly displayed Corneliano as the **subtle fallback Hero**.

Path values for the credible ranking (`A/B/C/D/E` = chromatic/pastel/luminous/twilight/solar): Tarifa **30.6/48.5/15.5/0/0**; Parentis **0/16.4/21/0/0**; Burntisland **20.2/43.5/0/0.3/0**.

Top five rejected analyzed candidates:

| Location (all Windy) | Evidence | Beauty | SunsetScore | FinalScore | A/B/C/D/E | Rejection |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| London / Trafalgar Square | 13.2 | 1.3 | 9.6 | 9.5 | 13.2/0/0/0/0 | Insufficient Evidence; city texture/color without a valid horizon transition |
| Finse | 5.7 | 0 | 4.0 | 4.0 | 0/5.7/0/0/0 | Insufficient Evidence in an overcast station/landscape |
| Eckhofe | 0 | 0 | 0 | 0 | 0/0/0/0/0 | No credible sunset signal in the obscured view |
| Oslo | 0 | 0 | 0 | 0 | 0/0/0/0/0 | Harbor lacks validated sunset sky color/gradient |
| North Cape, later cloudy frame | 0 | 0 | 0 | 0 | 0/0/0/0/0 | Later image lacks the historical frame's warm glow |

The JSON includes elevation, phase, image age, full metrics and reasons for each. The changing late North Cape image is not substituted for the earlier positive regression frame.

## 7. Hero behavior and screenshot fix

Selection chooses fresh Featured candidates first. If none exist, it chooses among fresh credible visible candidates. Hysteresis still uses the existing three-point gain within that eligible set; entering/leaving Featured revalidates eligibility. Scores and strength labels are unchanged by selection. Zero credible candidates yield the honest searching state. The public component additionally falls back to the first credible public card when a response lacks `rankedHero`.

The runtime selector has a version marker so development hot reload replaces the old Featured-only closure; future requests no longer retain old selection code indefinitely.

The user's right-side black Hero area was separately reproduced in headless Chrome using the actual Hero component and compiled Tailwind CSS. At a viewport width of 1920, the article was **1856 px** wide, but its media wrapper shrank to **1210.55 px** because `aspect-ratio` plus maximum height constrained an automatic width. Adding explicit `w-full` fixes the wrapper at **1856 px**, matching the image and article. Height remained about 680.94 px. The image keeps its aspect ratio via `object-cover`; normal responsive cropping remains. The isolated test browsers were stopped after measurement.

## 8. Validation and limits

- `npm test`: **174 tests passed**, 19 files. Coverage includes standard/alternative detection, false-positive controls, five captured real frames, solar projection calibration, Hero fallback/Featured priority/hysteresis, public credibility filtering, diagnostics, storage compatibility and empty states.
- `npm run lint`: passed.
- `npm run build -- --webpack`: production compilation, TypeScript and route generation passed.
- `git diff --check`: passed after restoring the generated `next-env.d.ts` to its pre-build content.
- Turbopack's previously observed laptop port-permission failure was not conflated with the successful requested Webpack build.

Remaining limitations: sky masks are geometric rather than semantic; smooth pale foreground can still create small scores, and narrow/occluded low-saturation glows can be missed. The explicit luminous alternative is calibrated on a small sample and needs continued negative controls. Solar-glow localization is disabled without camera field-of-view calibration. The generous existing freshness limit can admit lagging source snapshots. Feature eligibility and presentation strength remain separate: a 33.9-point sunset can satisfy Featured thresholds while honestly displaying `subtle`. Feedback has only three comparisons and no original image archive for most entries. No overall recall/precision improvement percentage is claimed.

Providers, registry/discovery, coverage optimizer, live playback, attribution, dedupe radius/algorithm, hysteresis threshold, LocalTime and API request limits are unchanged. Existing user modifications to camera candidates and the lockfile remain intact.
