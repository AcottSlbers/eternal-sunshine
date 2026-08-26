import { describe, expect, it } from "vitest";
import { UNAVAILABLE_IMAGE_VIABILITY } from "../lib/image-viability";
import { getImageFreshness, getSunsetOpportunityScore } from "../lib/ranking";

describe("sunset opportunity metadata", () => {
  it("strongly downgrades stale webcam images", () => {
    const now = new Date("2026-08-25T12:00:00Z");
    expect(getImageFreshness("2026-08-25T11:55:00Z", now)).toMatchObject({ score: 100, stale: false });
    expect(getImageFreshness("2026-08-24T12:00:00Z", now)).toMatchObject({ score: 0, stale: true });
  });

  it("treats unavailable optional metadata neutrally rather than as zero", () => {
    const score = getSunsetOpportunityScore({ sunsetPhaseScore: 100, sunAlignmentScore: 65, freshnessScore: 55, imageViability: UNAVAILABLE_IMAGE_VIABILITY, qualityWeight: 1 });
    expect(score).toBeGreaterThan(70);
  });
});
