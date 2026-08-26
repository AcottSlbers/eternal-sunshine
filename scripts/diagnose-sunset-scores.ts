import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

async function main() {
  const { createRanking } = await import("../lib/ranking");
  const ranking = await createRanking();
  const scores = ranking.results.map((result) => result.sunsetScore).sort((first, second) => first - second);
  const top = ranking.results[0];
  console.log(JSON.stringify({
    generatedAt: ranking.generatedAt,
    candidateCount: ranking.results.length,
    distribution: {
      minimum: scores[0] ?? 0,
      median: Math.round(median(scores) * 10) / 10,
      maximum: scores.at(-1) ?? 0,
    },
    topRankedImage: top ? {
      cameraId: top.camera.id, cameraName: top.camera.name, imageUrl: top.camera.lastKnownImageUrl ?? top.camera.imageUrl,
      sunsetEvidenceScore: top.sunsetEvidenceScore, sunsetBeautyScore: top.sunsetBeautyScore,
      sunsetScore: top.sunsetScore, finalScore: top.finalScore,
    } : null,
    candidates: ranking.results.map((result) => ({
      cameraId: result.camera.id, cameraName: result.camera.name,
      sunsetEvidenceScore: result.sunsetEvidenceScore, sunsetBeautyScore: result.sunsetBeautyScore,
      sunsetScore: result.sunsetScore, finalScore: result.finalScore,
    })),
    requests: ranking.provider,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
