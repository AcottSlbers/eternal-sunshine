import { notFound } from "next/navigation";
import { CalibrationWorkbench } from "@/components/CalibrationWorkbench";
import { calibrationCandidates } from "@/lib/calibration";
import { createRanking } from "@/lib/ranking";
import { createHeroSelector } from "@/lib/public-ranking";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  // An isolated selector avoids changing the public runtime hero just by inspecting data.
  const ranking = await createRanking(new Date(), createHeroSelector());
  return <CalibrationWorkbench candidates={calibrationCandidates(ranking)} generatedAt={ranking.generatedAt} providers={ranking.providerDiagnostics} />;
}
