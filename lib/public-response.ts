import { getSunsetStrength } from "@/lib/sunset-strength";
import { getCameraAttribution } from "@/lib/providers/attribution";
import type { PublicRankingResponse, PublicSunset } from "@/types/public-ranking";
import type { RankedSunset, RankingResponse } from "@/types/ranking";

function toPublicSunset(item: RankedSunset): PublicSunset {
  const camera = item.camera;
  return {
    camera: {
      id: camera.id,
      name: camera.name,
      country: camera.country,
      region: camera.region,
      source: camera.source,
      attribution: getCameraAttribution(camera),
      sourceUrl: camera.sourceUrl,
      providerUrl: camera.providerUrl,
      hasLiveStream: camera.hasLiveStream === true,
      livePlayer: camera.livePlayer,
      previewUrl: camera.lastKnownImageUrl ?? camera.imageUrl,
    },
    sunsetScore: item.sunsetScore,
    sunsetStrength: getSunsetStrength(item.sunsetScore),
    imageAgeMinutes: item.imageAgeMinutes,
    cameraTimeZone: item.cameraTimeZone,
  };
}

export function toPublicRanking(ranking: RankingResponse): PublicRankingResponse {
  return {
    generatedAt: ranking.generatedAt,
    totalCameras: ranking.totalCameras,
    visibleCount: ranking.diagnostics.visibleSunsets,
    rankedHero: ranking.featuredSunset ? toPublicSunset(ranking.featuredSunset) : null,
    results: ranking.results.map(toPublicSunset),
  };
}
