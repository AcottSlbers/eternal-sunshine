# Phase 3.5 — Beauty after conservative sunset detection

Implemented and evaluated on 2026-09-11. The quality recalibration is validated on synthetic scenes and one admitted real sunset; broader real-world validation and the requested Cape Town/Greece pair remain open.

## Scoring change

Evidence classification, its weights, the threshold of 20, dynamic horizon detection, foreground leakage protection, and solar/direction checks are unchanged. Tests pin the original Evidence values on all 16 established fixtures. The twelve captured real frames also retain exactly the same Evidence scores.

Four new quality metrics use the existing per-column sky boundary, at the existing maximum analysis resolution of 256×144:

- `pastelSunsetScore`: moderate-saturation peach/yellow/pink/lavender pixels in lower sky, supported by connected sky geometry. Hue <65° or ≥265°, saturation ≥0.12 (pastel ≤0.55), value ≥0.35, luminance ≥0.22 (pastel ≥0.4).
- `horizonIlluminationWidthScore`: longest adjacent run of illuminated lower-sky columns among 16 columns. A column needs at least 10% illuminated lower-sky pixels. It does not require a large warm area across the whole frame.
- `illuminatedCloudScore`: dark bands with chromatically illuminated neighbors across eight vertical sky bands, averaged across columns. Generic gray texture does not count.
- `verticalSunsetGradientScore`: cool-to-warm progression across eight sky-relative bands, directional consistency of color changes, luminance progression, and lower-sky color support.

All four metrics are 0–100. Connected-component geometry and sky confidence support them, but they are **quality measurements, not new Evidence**. Beige clouds can register in the pastel mask while still receiving zero Evidence, Beauty, and SunsetScore. The test suite covers this case explicitly.

After Evidence passes, Beauty is a weighted quality sum: color diversity 12%, color quality 18%, verified horizon glow 16%, illumination width 12%, illuminated clouds 12%, vertical gradient 12%, contrast 10%, dynamic range 5%, texture 3%. Color quality uses the stronger of existing saturation strength and 60% of the pastel metric, avoiding a double bonus or requiring both pastel and saturated colors. Existing exposure/darkness penalties still apply.

Admitted images use `SunsetScore = 0.15 × Evidence + 0.85 × Beauty`, with a ceiling of 100. Below Evidence 20, the previous conservative calculation remains, capped at 19. `evidenceGateCeiling` reports this ceiling explicitly. The gate creates a deliberate transition at admission; near-threshold cameras can still appear/disappear. This change does not retune hero eligibility or hysteresis.

The unchanged FinalScore formula still applies opportunity after visual scoring. Providers, registry, coverage, dedupe, live player, attribution, hydration, and request limits are untouched. Developer panels and calibration exports already enumerate metrics, so the new fields appear automatically; the public response still omits technical scores.

## Same-frame real comparison

Baseline ranking: **2026-09-11 17:05:28 UTC**. Existing registry: 300 Windy plus 34 MeteoGalicia cameras. Sixteen astronomical candidates, twelve analyzed images, one admitted sunset, eleven Evidence rejections, four other rejections. No MeteoGalicia cameras were in the current astronomical window.

Downloaded candidate frames were held temporarily outside the repository and rescored from identical bytes at the same astronomical phase. No further image requests were needed for this comparison; no credentials, signed image URLs, or image archives are committed.

| Camera | Evidence before/after | SunsetScore before | SunsetScore after |
| --- | ---: | ---: | ---: |
| Marathia / Paralia Kourouta | 24.3 / 24.3 | 20.0 | 46.7 |
| Rovaniemi / Maakuntakatu | 4.4 / 4.4 | 3.1 | 3.1 |
| Palace District | 1.6 / 1.6 | 1.1 | 1.1 |
| Kirovsk | 0 / 0 | 0 | 0 |
| North Cape | 0 / 0 | 0 | 0 |
| Neringa / Juodkrantė | 0 / 0 | 0 | 0 |
| Palanga Pier | 0 / 0 | 0 | 0 |
| Rzeszow | 0 / 0 | 0 | 0 |
| Budapest / Duna Street | 0 / 0 | 0 | 0 |
| Saint Petersburg west | 0 / 0 | 0 | 0 |
| Saint Petersburg | 0 / 0 | 0 | 0 |
| Mirova pod Kozakovem | 0 / 0 | 0 | 0 |

Marathia's provider image timestamp was **16:54:56 UTC**. It shows a peach/orange horizon over the sea with dark coastal foreground. Beauty becomes 50.7, FinalScore 45.6, pastel 70.3, illumination width 71.8, illuminated clouds 0, vertical gradient 55.3. Broad soft sky color and composition explain the increase; it receives no illuminated-cloud bonus. Visible minimum/median/maximum change from **20/20/20** to **46.7/46.7/46.7**, with a population of only one.

**Known false negative:** visually inspecting North Cape revealed a visible sun and warm horizon despite Evidence 0. Its foreground leakage is 0.846, geometry 30.6, foreground penalty 13.9. Preserving the existing Evidence gate also preserves this rejection. These eleven rejected frames must not all be described as ground-truth non-sunsets. Improving this case would require a separately validated change to detection, outside this task's constraints.

## Fresh live ranking after implementation

`npm run diagnose-sunset-scores` at **2026-09-11 17:10:06 UTC** again evaluated twelve images from sixteen astronomical candidates. One visible sunset, eleven Evidence rejections, four other rejections, no hero-eligible candidate, no geographic suppressions.

Visible SunsetScore **minimum 51.7 / median 51.7 / maximum 51.7** (n=1). The image/phase has advanced since the frozen comparison, so the difference between 46.7 and 51.7 is not attributed to another code change.

| Rank | Camera | Evidence | Beauty | SunsetScore | FinalScore | Pastel | Width | Clouds | Gradient |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Marathia / Paralia Kourouta | 28.9 | 55.7 | 51.7 | 49.7 | 77.8 | 80.5 | 0 | 64.2 |

The admitted real sunset no longer sits in the 20–30 range. A sample of one cannot establish a general score distribution or validate strong real sunsets across providers.

## Cape Town comparison limitation

Milnerton is enabled in the unchanged registry, but its solar elevation at the baseline timestamp was **−7.18°**, outside the configured extended window of −6° to +2.5°. It was not fetched merely to complete a comparison outside the existing pipeline. The original two frames described in the task were not supplied. Thus **Cape Town > Greece has not been verified on that real pair**. The original snapshots are needed to close this validation gap. The synthetic golden/cloud image ranking is evidence for the mechanism, not a substitute for the missing real comparison.

## Synthetic regression results

Phase score 95 for all fixtures:

| Fixture | Evidence | Beauty | SunsetScore |
| --- | ---: | ---: | ---: |
| Saturated illuminated clouds | 100 | 80.2 | 83.1 |
| Broad golden illuminated clouds | 90.0 | 77.4 | 79.3 |
| Pastel sunset | 41.7 | 53.3 | 51.6 |
| Narrow coherent horizon | 60.8 | 61.6 | 61.5 |
| Ordinary colorful landscape (existing) | 5.7 | 0 | 4.0 |
| Blue sky + yellow field | 0 | 0 | 0 |
| Tiny orange object | 0.1 | 0 | 0 |
| Selfoss-like terrain | 0 | 0 | 0 |
| Snow / road / gray harbor / gray clouds / night | 0 | 0 | 0 |

The golden/cloud fixture exceeds pastel by 27.7 points. Saturated clouds rank higher again. Width, cloud structure, bounded metrics, preserved Evidence, narrow warm bands under 20% of the frame, and explicit non-sunset controls have regression assertions.

## Validation

- `npm test`: 149 tests passed in 18 files.
- `npm run lint`: passed.
- `npm run build`: attempted with and without sandbox escalation; Turbopack failed while binding a local port (`Operation not permitted`).
- `npm run build -- --webpack`: production build and TypeScript validation passed, all routes generated.
- `git diff --check`: passed after restoring the build-generated `next-env.d.ts` to its pre-build state.

Node was available through the user's nvm installation; commands used that installation on PATH. Pre-existing changes to `data/camera-candidates.json` and `package-lock.json` were left intact.
