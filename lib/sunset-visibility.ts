import { MIN_FEATURED_SUNSET_EVIDENCE, MIN_FEATURED_SUNSET_SCORE, MIN_VISIBLE_SUNSET_EVIDENCE, MIN_VISIBLE_SUNSET_SCORE } from "@/lib/config";
import type { RankedSunset, SunsetVisibility } from "@/types/ranking";
import { hasHighConfidenceLuminousEvidence, primaryEvidencePath, type EvidencePath } from "@/lib/sunset-evidence";

type GateInput = Pick<RankedSunset, "sunsetEvidenceScore" | "sunsetBeautyScore" | "sunsetMetrics" | "sunsetScore" | "visualScoreStatus" | "imageViability" | "isSunSetting">;

export interface CredibleSunsetDecision {
  isCredibleSunset: boolean;
  credibleSunsetReason: string;
  primaryEvidencePath: EvidencePath;
}

export function isCredibleSunset(item: GateInput & Pick<RankedSunset, "sunsetMetrics">): CredibleSunsetDecision {
  const classified = classifySunsetVisibility(item);
  const primary = primaryEvidencePath(item.sunsetMetrics);
  const credible = classified.visibility === "visible" || classified.visibility === "featured";
  return { isCredibleSunset: credible, primaryEvidencePath: primary,
    credibleSunsetReason: credible ? `Credible via ${primary}: ${classified.reason}` : classified.reason };
}

export function classifySunsetVisibility(item: GateInput): { visibility: SunsetVisibility; reason: string } {
  if (!item.isSunSetting) return { visibility: "rejected-other", reason: "Rejected: sun is not descending" };
  if (item.visualScoreStatus !== "analyzed" || item.imageViability.status !== "viable" || !item.imageViability.viable) {
    return { visibility: "rejected-other", reason: `Rejected: ${item.imageViability.reason ?? "preview analysis unavailable or image not viable"}` };
  }
  if (!Number.isFinite(item.sunsetEvidenceScore) || !Number.isFinite(item.sunsetScore) || !Number.isFinite(item.sunsetBeautyScore)) {
    return { visibility: "rejected-other", reason: "Rejected: invalid visual scores" };
  }
  if (item.sunsetEvidenceScore < MIN_VISIBLE_SUNSET_EVIDENCE) {
    if (hasHighConfidenceLuminousEvidence(item.sunsetMetrics) && item.sunsetBeautyScore >= 25
      && item.sunsetScore >= MIN_VISIBLE_SUNSET_SCORE) {
      return { visibility: "visible", reason: "Visible sunset via high-confidence luminous horizon and sufficient Beauty" };
    }
    return { visibility: "rejected-evidence", reason: "Rejected: insufficient sunset evidence" };
  }
  if (item.sunsetScore < MIN_VISIBLE_SUNSET_SCORE) {
    return { visibility: "rejected-evidence", reason: "Rejected: insufficient visual sunset score" };
  }
  if (item.sunsetEvidenceScore >= MIN_FEATURED_SUNSET_EVIDENCE && item.sunsetScore >= MIN_FEATURED_SUNSET_SCORE) {
    return { visibility: "featured", reason: "Visible sunset; eligible for hero" };
  }
  return { visibility: "visible", reason: "Visible sunset; below featured threshold" };
}
