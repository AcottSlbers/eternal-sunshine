import type { RankingResponse } from "@/types/ranking";

export function Ranking({ ranking }: { ranking: RankingResponse }) {
  return (
    <section className="py-14" aria-labelledby="ranking-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-[0.65rem] uppercase tracking-[0.35em] text-orange-200/60">Right now</p><h2 id="ranking-title" className="text-2xl font-light tracking-tight sm:text-3xl">Sunset candidates</h2></div>
        <p className="text-sm text-stone-500">Known cameras: {ranking.totalCameras} · Current sunset candidates: {ranking.candidatesEvaluated} · {ranking.generatedAt.slice(11, 19)} UTC</p>
      </div>
      {ranking.results.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-stone-400">No mock camera is inside the configured sunset window at this instant.</div> :
        <ol className="grid gap-4 md:grid-cols-2">{ranking.results.map((item, index) => (
          <li key={item.camera.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:border-orange-300/30 hover:bg-white/[0.055]">
            {item.camera.lastKnownImageUrl && <a href={item.camera.sourceUrl} target="_blank" rel="noreferrer" className="block h-44 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(item.camera.lastKnownImageUrl).slice(1, -1)})` }} aria-label={`Open ${item.camera.name} on Windy`} />}
            <div className="p-6">
            <div className="flex items-start justify-between gap-4"><div><span className="text-xs text-orange-200/50">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-2 text-xl font-medium">{item.camera.name}</h3><p className="mt-1 text-sm text-stone-500">{item.camera.region ? `${item.camera.region}, ` : ""}{item.camera.country}</p></div><div className="text-right"><span className="text-3xl font-light text-orange-200">{item.sunsetScore}</span><p className="text-[0.6rem] uppercase tracking-widest text-stone-600">Mock score</p></div></div>
            <div className="mt-7 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-sm"><span className="text-stone-500">Coordinates</span><span className="text-right font-mono text-stone-300">{item.camera.latitude.toFixed(2)}, {item.camera.longitude.toFixed(2)}</span><span className="text-stone-500">Solar elevation</span><span className="text-right font-mono text-stone-300">{item.solarElevation.toFixed(2)}°</span>{item.camera.lastKnownImageTimestamp && <><span className="text-stone-500">Image updated</span><span className="text-right text-stone-300">{new Date(item.camera.lastKnownImageTimestamp).toISOString().slice(0, 16).replace("T", " ")} UTC</span></>}</div>
            {item.camera.sourceUrl && <a className="mt-4 inline-block text-xs uppercase tracking-wider text-orange-200/70 hover:text-orange-200" href={item.camera.sourceUrl} target="_blank" rel="noreferrer">View on Windy ↗</a>}
            </div>
          </li>))}</ol>}
      <p className="mt-5 text-xs leading-relaxed text-stone-600">Scores remain temporary deterministic placeholders. Phase 2 fetches fresh metadata only for cameras already inside the sunset window; it does not download or analyze images.</p>
      <p className="mt-2 text-xs text-stone-600">Provider mode: {ranking.provider.mode}; refreshed metadata for {ranking.provider.refreshed} sunset candidates only.{ranking.provider.error && ` ${ranking.provider.error}`}</p>
    </section>
  );
}
