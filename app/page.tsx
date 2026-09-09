import { SunsetExperience } from "@/components/SunsetExperience";
import { toPublicRanking } from "@/lib/public-response";
import { createRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialRanking = null;
  let initialError = false;
  try {
    initialRanking = toPublicRanking(await createRanking());
  } catch {
    initialError = true;
  }
  return <SunsetExperience initialRanking={initialRanking} initialError={initialError} />;
}
