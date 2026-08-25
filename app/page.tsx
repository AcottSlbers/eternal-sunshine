import { DebugPanel } from "@/components/DebugPanel";
import { Ranking } from "@/components/Ranking";
import { createRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ranking = await createRanking();
  return (
    <main className="min-h-screen overflow-hidden">
      <div className="sun-glow" aria-hidden="true" />
      <section className="relative mx-auto flex max-w-6xl flex-col px-6 pb-20 pt-16 sm:px-10 sm:pt-24">
        <header className="border-b border-white/15 pb-14">
          <div className="mb-10 flex items-center justify-between gap-4 text-[0.65rem] uppercase tracking-[0.32em] text-amber-100/60">
            <span>Live astronomical window</span><span>{ranking.generatedAt.slice(11, 19)} UTC</span>
          </div>
          <p className="mb-5 text-xs uppercase tracking-[0.55em] text-orange-200/75">Following the light</p>
          <h1 className="max-w-5xl text-5xl font-light leading-[0.9] tracking-[-0.055em] text-stone-50 sm:text-7xl md:text-8xl">ETERNAL<br /><span className="font-serif italic text-orange-200">SUNSHINE</span></h1>
          <p className="mt-9 max-w-xl text-lg font-light leading-relaxed text-stone-300 sm:text-xl">Somewhere on Earth, the sun is always setting.</p>
        </header>
        <Ranking ranking={ranking} />
        <DebugPanel ranking={ranking} />
      </section>
    </main>
  );
}
