# Eternal Sunshine

Eternal Sunshine keeps a small worldwide webcam registry, calculates solar elevation locally, and requests fresh Windy metadata only for cameras currently near sunset.

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

Open [http://localhost:3000](http://localhost:3000). The JSON result is available at [http://localhost:3000/api/ranking](http://localhost:3000/api/ranking).

The page shows registry size, current UTC time, sunset candidates, coordinates, solar elevation, current Windy thumbnail metadata when available, and an exclusion-reason table. If the registry still contains mock cameras, the app stays in clearly labeled mock mode.

## Camera discovery

```bash
npm run discover-cameras
```

Discovery makes one bounded request for each of 24 longitude buckets, scores the returned metadata, and tries to retain four cameras per bucket with varied latitudes. Individual failed buckets do not stop the rest of the run.

- `data/camera-candidates.json` is the full normalized, scored discovery output for manual review.
- `data/cameras.json` is the smaller application registry, targeting approximately 96 enabled cameras.

Existing manual `enabled`, `qualityWeight`, `direction`, and `notes` values are preserved when a known Windy camera is rediscovered. Review both files after every discovery; sparse ocean buckets may need manual curation. Windy image URLs are short-lived, so the app refreshes metadata for current sunset candidates rather than treating registry URLs as permanent.

## Sunset selection

`lib/solar.ts` calculates elevation from UTC timestamp, latitude, and longitude with `suncalc`. Enabled cameras from `data/cameras.json` qualify only from -7° through +3° while the sun is descending; this excludes the simultaneous sunrise zone. Invalid coordinates are skipped before any provider request. The temporary score is not image analysis.

## Validation

```bash
npm test
npm run lint
npm run build
```

Tests cover threshold boundaries, Europe versus the opposite side of Earth, invalid coordinates, movement across longitudes, missing credentials, V3 normalization, candidate scoring, and bucket selection.

## Not implemented

There is no image analysis, machine learning, weather enrichment, database, authentication, queue, or deployment. Real discovery cannot run without a user-provided Windy key.
