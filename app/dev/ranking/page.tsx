import { DebugPanel } from "@/components/DebugPanel";
import { createRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function RankingDebugPage() {
  return <main className="mx-auto max-w-7xl px-6 py-12"><h1 className="mb-8 text-3xl">Sunset ranking diagnostics</h1><DebugPanel ranking={await createRanking()} /></main>;
}
