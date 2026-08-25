# AGENTS.md — Eternal Sunshine

## 1. Project identity

Project name: **Eternal Sunshine**

Core idea:

> Somewhere on Earth, the sun is always setting.

Eternal Sunshine is a web application that continuously identifies webcams around the world that are currently in or near sunset, analyzes their latest images, ranks the most visually impressive sunsets, and presents the best one as the main experience.

The project is initially a **local hobby-project MVP**. Prefer simplicity, transparency, low cost, and modular architecture over production-scale complexity.

The human developer understands APIs, automation, n8n, JavaScript concepts, and web development, but is new to Next.js. Keep the codebase easy to understand and avoid clever abstractions that are not needed.

---

## 2. Technical direction

Use:

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Server-side Route Handlers / server code
- `suncalc` for solar position calculations
- `sharp` for later server-side image analysis
- Windy Webcams API V3 as the first real webcam provider
- Open-Meteo optionally for weather enrichment
- local JSON data for the first camera pool
- in-memory caching for the MVP

Do NOT introduce yet:

- n8n
- Supabase
- another database
- authentication
- queues
- Redis
- Docker unless truly necessary
- machine learning
- paid APIs
- complex cloud infrastructure

The app must run locally with:

```bash
npm run dev
```

and be viewable at:

```text
http://localhost:3000
```

---

## 3. Security and secrets

Never hard-code API keys.

Windy credentials must later be read server-side from:

```text
.env.local
```

Example variable:

```text
WINDY_API_KEY=
```

Never prefix this key with `NEXT_PUBLIC_`.

Never send the API key to the browser.

Add `.env.local` to ignored files if it is not already ignored.

Provide an `.env.example` containing only placeholder values.

---

## 4. Core architecture

Keep external data sources behind provider abstractions.

The rest of the application must not depend directly on Windy-specific response structures.

Use a normalized camera type similar to:

```ts
export interface Camera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  imageUpdatedAt?: string;
  categories?: string[];
  enabled: boolean;
  qualityWeight: number;
  direction?: number;
  notes?: string;
}
```

Likely modules:

```text
app/
  page.tsx
  api/
    ranking/
      route.ts

components/
  HeroSunset.tsx
  Ranking.tsx
  SunsetCard.tsx

data/
  cameras.json

lib/
  config.ts
  solar.ts
  ranking.ts
  image-score.ts
  providers/
    webcam-provider.ts
    mock-webcam-provider.ts
    windy-webcam-provider.ts
  weather.ts

scripts/
  discover-cameras.ts

types/
  camera.ts
  ranking.ts
```

This structure is guidance, not a rigid requirement. Prefer clear code over unnecessary file fragmentation.

---

## 5. Sunset candidate logic

Do not download every webcam image.

The intended pipeline is:

```text
camera pool
    ↓
calculate current solar elevation for every camera
    ↓
discard cameras outside sunset window
    ↓
only request images for current candidates
    ↓
analyze images
    ↓
rank candidates
```

Initial configurable sunset window:

```text
maximum solar elevation: +3°
minimum solar elevation: -7°
```

Keep these values in a central config.

Solar position must be derived from:

- timestamp
- latitude
- longitude

Use UTC internally where practical.

The code should expose a function roughly equivalent to:

```ts
getSunsetCandidates(cameras, date)
```

Each result should include the current solar elevation.

---

## 6. Future webcam pool strategy

The intended MVP pool is approximately **96 curated webcams**.

This is NOT the number of webcams that should be downloaded every refresh.

Conceptually:

```text
24 longitude bands × ~4 good cameras = ~96 cameras
```

At a given moment, only a small subset should be near sunset and therefore require image requests.

The pool may later expand to roughly 192–300 cameras if needed for redundancy.

Camera selection should prefer:

- coast / beach
- lake
- mountain
- landscape
- scenic city views
- visible sky
- visible horizon
- reliable recent updates
- geographical diversity
- different latitudes
- multiple fallback cameras in similar longitude regions

Avoid a pool dominated by:

- traffic cameras
- indoor cameras
- close-up streets
- cameras with little sky
- chronically stale images

Do not build the global discovery process until the real Windy provider is implemented and tested.

---

## 7. Future image scoring

Version 1 should use deterministic image analysis, NOT AI or machine learning.

Resize images before analysis, for example to a maximum of approximately:

```text
256 × 144
```

Do not retain large decoded image buffers longer than necessary.

A future `SunsetScore` should be normalized to 0–100 and expose its component metrics.

Potential components:

- warm-color share
- red/orange presence
- pink/magenta/purple presence
- average saturation
- color diversity
- luminance contrast
- dynamic range
- horizon glow
- optional spatial weighting

Potential penalties:

- almost completely dark
- severely overexposed
- nearly grayscale
- stale webcam image

Prefer HSV/HSL-style color reasoning over one fixed RGB target.

The scoring API should be interpretable. Do not return only a final score; expose component metrics for debugging and later tuning.

---

## 8. Ranking model

A ranking item should eventually resemble:

```ts
interface RankedSunset {
  camera: Camera;
  solarElevation: number;
  sunsetScore: number;
  imageUrl?: string;
  imageTimestamp?: string;
  metrics: Record<string, number>;
}
```

The API should eventually return something like:

```ts
{
  generatedAt: string;
  candidatesEvaluated: number;
  results: RankedSunset[];
}
```

Sort descending by `sunsetScore`.

A broken camera must never make the entire ranking fail.

Use per-camera error isolation once external webcam calls are introduced.

---

## 9. Caching philosophy

For the hobby MVP, minimize external calls.

Do not continuously recompute data if nobody is using the site.

A later acceptable flow is:

```text
request ranking
    ↓
cached ranking still fresh?
    ├─ yes → return cache
    └─ no  → recalculate
```

A webcam image should later only be re-analyzed when its source image has actually changed, if provider metadata allows this.

Use simple in-memory caching first.

---

# DEVELOPMENT PHASES

The phases below are gates.

**Do not continue automatically into the next phase unless the user explicitly asks.**

---

## PHASE 1 — Local foundation

### Goal

Create a clean, understandable Next.js application that runs locally and proves the astronomical filtering logic.

### Tasks

1. Inspect the current repository/folder before changing anything.
2. If no Next.js project exists, initialize one using:
   - Next.js
   - TypeScript
   - App Router
   - Tailwind CSS
   - ESLint
3. Install only dependencies needed for this phase.
4. Add `suncalc`.
5. Create normalized `Camera` and ranking-related types.
6. Add a small mock camera dataset with geographically distributed cameras.
   - Around 12–24 mock entries are sufficient for Phase 1.
   - They can represent real cities/locations, but do NOT require real webcam URLs yet.
7. Implement the solar-elevation calculation.
8. Implement configurable sunset-window filtering.
9. Add a server endpoint such as:
   ```text
   GET /api/ranking
   ```
10. For Phase 1, generate a temporary/mock visual score for current candidates.
    - Clearly label it in code as temporary.
    - Do not pretend it is real image analysis.
11. Build a minimal but polished page showing:
    - `ETERNAL SUNSHINE`
    - `Somewhere on Earth, the sun is always setting.`
    - current UTC time
    - current candidate locations
    - solar elevation
    - temporary score
12. Include a small developer/debug section or console-friendly output that makes it easy to verify why a camera was or was not selected.
13. Add a concise `README.md` with:
    - prerequisites
    - install command
    - dev command
    - project structure
    - what Phase 1 does
    - what is intentionally not implemented yet
14. Run validation:
    ```bash
    npm run lint
    npm run build
    ```
15. Fix errors rather than suppressing them.

### Phase 1 success criteria

Phase 1 is complete only when:

- the app starts locally
- the homepage renders
- `/api/ranking` works
- solar elevations are calculated from current time + lat/lon
- cameras outside the sunset window are excluded
- no webcam API key is required
- no secrets exist in the repository
- lint passes
- production build passes

### STOP AFTER PHASE 1

When complete:

1. Stop.
2. Do not start Windy integration.
3. Do not add image analysis.
4. Do not deploy.
5. Report:
   - what you created
   - files added/changed
   - commands run
   - lint/build status
   - exact command the user should run to start the app
   - any assumptions or blockers

---

## PHASE 2 — Real Windy webcam provider

Only start when explicitly requested.

Goals:

- implement provider abstraction if not already complete
- connect Windy Webcams API V3 server-side
- read API key from `.env.local`
- normalize Windy responses into the internal `Camera` format
- correctly handle attribution/source links
- add timeouts and error isolation
- preserve a mock provider for development/testing
- do NOT yet globally scan hundreds of cameras

Validate with a small known set of cameras first.

---

## PHASE 3 — Camera discovery and 96-camera pool

Only start when explicitly requested.

Create:

```text
scripts/discover-cameras.ts
```

Purpose:

- discover candidate webcams via the provider
- build geographically diverse candidate sets
- organize candidates across longitude bands
- export a reviewable JSON file
- make manual visual curation easy

Do not blindly accept 96 cameras.

Discovery should produce more candidates than needed, then allow human curation.

Target:

```text
~96 enabled curated cameras
```

with geographical redundancy.

---

## PHASE 4 — Real image analysis

Only start when explicitly requested.

Use `sharp`.

For current sunset candidates only:

1. fetch current image
2. resize
3. decode pixels
4. compute interpretable metrics
5. calculate `SunsetScore`
6. release image buffers
7. rank

Add tests using a small local fixture set if practical.

Do not introduce ML.

---

## PHASE 5 — Product-quality UI and deployment

Only start when explicitly requested.

Desired visual direction:

- cinematic
- calm
- image-first
- dark-neutral interface
- large photography
- minimal weather-app chrome

Hero copy:

```text
ETERNAL SUNSHINE
Somewhere on Earth, the sun is always setting.
```

Primary content:

```text
BEST SUNSET RIGHT NOW
```

Then:

```text
TOP SUNSETS RIGHT NOW
```

Potential later features:

- interactive world map
- visible sunset belt / terminator
- weather context
- community voting
- historic best sunsets
- provider expansion
- optional n8n orchestration
- database persistence

None of these are required for the initial MVP.

---

# CODING PRINCIPLES

1. Favor understandable code over abstraction.
2. Keep TypeScript types explicit.
3. Do not use `any` unless unavoidable and documented.
4. Keep provider-specific data out of UI components.
5. Keep solar calculations testable as pure functions where possible.
6. Keep score calculations testable as pure functions where possible.
7. Never expose server secrets.
8. Handle individual external failures gracefully.
9. Avoid premature optimization.
10. Avoid premature infrastructure.
11. Do not silently replace broken real functionality with mocks once a phase requires real functionality.
12. Add comments only where they explain non-obvious reasoning.
13. Keep the project easy for a developer new to Next.js to navigate.

---

# WORKING STYLE FOR CODEX

Before editing:

1. Inspect the repository.
2. Explain internally what already exists.
3. Reuse good existing work rather than replacing it blindly.

During implementation:

- work through the currently requested phase completely
- use the terminal when useful
- inspect errors
- fix root causes
- do not hide failures

Before finishing:

- run the relevant validation commands
- check for accidental secrets
- summarize changes concisely
- state any limitation clearly

If something requires a credential or user-only action, implement everything possible without the credential and clearly state the single action needed from the user.

---

# CURRENT TASK

The current requested task is:

**Execute PHASE 1 only.**

Do not continue to Phase 2 without explicit user approval.
