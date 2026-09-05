export const SUNSET_WINDOWS = {
  strict: { minimumElevation: -4.5, maximumElevation: 1.5 },
  extended: { minimumElevation: -6, maximumElevation: 2.5 },
} as const;

export const SUNSET_WINDOW = SUNSET_WINDOWS.extended;
export const MINIMUM_DESIRED_CANDIDATES = 8;
export const MIN_VISIBLE_SUNSET_EVIDENCE = 20;
export const MIN_VISIBLE_SUNSET_SCORE = 20;
export const MIN_FEATURED_SUNSET_EVIDENCE = 30;
export const MIN_FEATURED_SUNSET_SCORE = 30;
export const SOLAR_TREND_MINUTES = 10;
export const SUNSET_EMPTY_STATE = {
  title: "Searching for the next great sunset…",
  description: "Cameras near sunset are being checked for a visible sunset. Check back soon.",
} as const;
export const LONGITUDE_BUCKET_COUNT = 24;
export const TARGET_CAMERA_COUNT = 192;
export const CAMERAS_PER_BUCKET = TARGET_CAMERA_COUNT / LONGITUDE_BUCKET_COUNT;
export const STALE_IMAGE_MINUTES = 12 * 60;

export const COVERAGE_SLOT_MINUTES = 15;
export const TARGET_STRICT_COVERAGE = 8;
export const IDEAL_STRICT_COVERAGE = 12;
export const TARGET_TOTAL_COVERAGE = 18;
export const MIN_CAMERA_QUALITY = 50;
export const TARGET_GOLD_CAMERA_COUNT = 300;
export const COVERAGE_REGISTRY_SIZES = [192, 250, 300, 400] as const;
