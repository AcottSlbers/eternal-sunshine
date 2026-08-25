# Eternal Sunshine

A local Next.js MVP that finds which mock camera locations are currently near sunset using astronomical calculations.

## Prerequisites and setup

- Node.js 20.9 or newer
- npm

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The JSON ranking is available at [http://localhost:3000/api/ranking](http://localhost:3000/api/ranking).

## Phase 1

Phase 1 contains 18 geographically distributed mock cameras. `lib/solar.ts` uses `suncalc` to calculate each camera's current solar elevation from UTC time and coordinates. Only enabled cameras between -7° and +3° enter the ranking. A clearly marked temporary score makes the result sortable until real image analysis exists. The homepage and API also expose exclusion reasons for debugging.

## Structure

- `app/` — App Router page, styling, and ranking route handler
- `components/` — ranking and debug UI
- `data/cameras.json` — local normalized mock camera pool
- `lib/` — central configuration, solar filtering, and temporary ranking
- `types/` — camera and ranking contracts

## Intentionally not implemented

There is no Windy API integration, webcam discovery, image downloading or analysis, weather data, database, authentication, or deployment. Phase 1 requires no secrets or API key. `.env.local` is ignored, and `.env.example` contains placeholders only.

## Checks

```bash
npm run lint
npm run build
```
