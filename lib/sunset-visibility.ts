import { MIN_FEATURED_SUNSET_EVIDENCE, MIN_FEATURED_SUNSET_SCORE, MIN_VISIBLE_SUNSET_EVIDENCE, MIN_VISIBLE_SUNSET_SCORE } from "@/lib/config";
import type { RankedSunset, SunsetVisibility } from "@/types/ranking";

type GateInput = Pick<RankedSunset, "sunsetEvidenceScore" | "sunsetScore" | "visualScoreStatus" | "imageViability" | "isSunSetting">;

export function classifySunsetVisibility(item: GateInput): { visibility: SunsetVisibility; reason: string } {
  if (!item.isSunSetting) return { visibility: "rejected-other", reason: "Rejected: sun is not descending" };
  if (item.visualScoreStatus !== "analyzed" || item.imageViability.status !== "viable" || !item.imageViability.viable) {
    return { visibility: "rejected-other", reason: `Rejected: ${item.imageViability.reason ?? "preview analysis unavailable or image not viable"}` };
  }
  if (!Number.isFinite(item.sunsetEvidenceScore) || !Number.isFinite(item.sunsetScore)) {
    return { visibility: "rejected-other", reason: "Rejected: invalid visual scores" };
  }
  if (item.sunsetEvidenceScore < MIN_VISIBLE_SUNSET_EVIDENCE) {
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
