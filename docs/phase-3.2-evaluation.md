# Phase 3.2 real-data evaluation

Command: `npm run diagnose-sunset-scores`.
Snapshot: **2026-09-05 12:06:03.548 UTC**, current Windy metadata and images, not historical or simulated imagery.

- Registry: 300 (unchanged).
- Astronomical candidates / images analyzed: 12 / 12.
- Visible sunsets before dedupe: 4; featured-qualified: 3.
- Public cards after 25-km dedupe: 4; suppressed nearby: 0.
- Visible visual SunsetScore minimum / median / maximum: **27.5 / 44.9 / 51.2**.
- Hero: Azeyskoye, camera `1629633853`, finalScore **50.6**.
- Public #1–#2 finalScore gap: **0.7**. This standalone process has no previous hero; hysteresis between refreshes is separately regression-tested.

## Actual before and after ranking

Both columns describe the same live evaluation, so changing source images do not confound the comparison.

| Camera | ID | Evidence | SunsetScore | finalScore | Before rank | After rank |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Азейское сельское поселение (Azeyskoye) | 1629633853 | 51.9 | 51.2 | 50.6 | 1 | 1 |
| Юртинское городское поселение (Yurty) | 1760493426 | 52.5 | 50.6 | 49.9 | 2 | 2 |
| Guwahati › South | 1694354779 | 40.1 | 39.2 | 38.0 | 3 | 3 |
| Киренское городское поселение (Kirensk) › South-west | 1793908003 | 31.6 | 27.5 | 26.2 | 4 | 4 |

No eligible pair in this snapshot was within the suppression radius; this live run therefore does **not** demonstrate an active dedupe suppression.

## Azeyskoye pair

The registry coordinates are (54.53189, 100.59752) for `1629633853` and (54.5581, 100.57851) for `1624904845`, roughly 3.2 km apart. They fall well within the configured 25-km radius. A regression test using these actual coordinates verifies that only the higher-scored camera survives when both qualify; the test's scores are synthetic and not a claim about current imagery.

In the live snapshot, `1624904845` already fails the unchanged visual gate: Evidence **5.1**, SunsetScore **3.5**, finalScore **3.5**, reason `Rejected: insufficient sunset evidence`. It remains in candidate diagnostics and is correctly not counted as geographically suppressed. Thus only one Azeyskoye entry appears publicly today, but not because both were eligible and deduplicated in this run.

Law-Racoviță also remains excluded (Evidence 6.1, SunsetScore 4.3). No thresholds were loosened to obtain more visible or duplicate candidates.

## Verification scope

Tests cover 5-km suppression, 100/150-km separation despite identical names, deterministic ties, configurable radius, no transitive region collapse, geographic wraparound, retained debug scores/reasons, the Azeyskoye coordinate pair, hero score-gain boundaries, stale/invalid/missing heroes, failed gates, refreshed rather than historical scores, concurrent request ordering, no-featured empty behavior, and a retained hero whose nearby challenger wins the public card slot.

Scorer, Windy provider, registry, coverage optimizer, live-player component, and hydration fix are unchanged. Current webcam imagery can change on every subsequent evaluation; this snapshot is not a guarantee of persistent ranking order.

Final checks: `npm test` passed 82 tests across 13 files; `npm run lint`, `npm run build`, and `git diff --check` passed. Both the running homepage and `/api/ranking` returned HTTP 200; rendered HTML contains Sunset Strength and diversity diagnostics. A subsequent HTTP smoke check found 10 astronomical/analyzed candidates, 3 visible, 3 featured, 3 public, 0 suppressed, and a public top-two gap of 11.8. Its hero was still Azeyskoye `1629633853`; the runtime decision reported switching from Guwahati after the challenger reached the configured gain. This later check is separate from the full 12:06 snapshot above.
