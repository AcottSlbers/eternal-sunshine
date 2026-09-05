import type { RankingResponse } from "@/types/ranking";

export function DebugPanel({ ranking }: { ranking: RankingResponse }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-stone-400">
      <summary className="cursor-pointer select-none uppercase tracking-[0.25em] text-stone-500">Developer debug · all cameras</summary>
      <dl className="mt-5 flex flex-wrap gap-5 text-xs">{Object.entries(ranking.diagnostics).map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="text-lg text-stone-200">{value}</dd></div>)}</dl>
      <section className="mt-6" aria-labelledby="visual-score-debug">
        <h3 id="visual-score-debug" className="text-xs uppercase tracking-[0.22em] text-orange-200/60">Current candidate score distribution</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {ranking.candidateDiagnostics.map((diagnostic) => {
            const item = diagnostic.scored;
            return <article key={diagnostic.camera.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-stone-200">{diagnostic.camera.name}</p><p className="mt-1 text-xs text-stone-400">{diagnostic.reason}</p><p className="mt-1 text-xs text-stone-500">{diagnostic.solarElevationTrend} · {diagnostic.solarTrendDegreesPerMinute.toFixed(5)}°/min · +10 min: {diagnostic.solarElevationLater.toFixed(2)}°</p></div>
                <div className="grid grid-cols-4 gap-3 text-right text-xs">
                  <div><span className="block text-stone-600">Evidence</span><strong className="text-orange-100">{item?.sunsetEvidenceScore.toFixed(1) ?? "—"}</strong></div>
                  <div><span className="block text-stone-600">Beauty</span><strong className="text-orange-100">{item?.sunsetBeautyScore.toFixed(1) ?? "—"}</strong></div>
                  <div><span className="block text-stone-600">Sunset</span><strong className="text-orange-100">{item?.sunsetScore.toFixed(1) ?? "—"}</strong></div>
                  <div><span className="block text-stone-600">Final</span><strong className="text-orange-100">{item?.finalScore.toFixed(1) ?? "—"}</strong></div>
                </div>
              </div>
              {item && <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1 border-t border-white/[0.06] pt-3 text-xs">
                {Object.entries(item.sunsetMetrics).map(([name, value]) => <div key={name} className="contents"><dt className="truncate text-stone-600">{name}</dt><dd className="text-right font-mono text-stone-400 sm:text-left">{value.toFixed(1)}</dd></div>)}
              </dl>}
            </article>
          })}
        </div>
      </section>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[40rem] text-left"><thead className="text-xs uppercase tracking-wider text-stone-600"><tr><th className="pb-3">Camera</th><th className="pb-3">Elevation</th><th className="pb-3">Azimuth</th><th className="pb-3">Status</th><th className="pb-3">Reason</th></tr></thead><tbody>{ranking.debug.map((item) => <tr key={item.cameraId} className="border-t border-white/[0.06]"><td className="py-3 text-stone-300">{item.name}</td><td className="py-3 font-mono">{item.solarElevation.toFixed(2)}°</td><td className="py-3 font-mono">{item.solarAzimuth.toFixed(0)}°</td><td className={item.selected ? "py-3 text-orange-200" : "py-3 text-stone-600"}>{item.selected ? "selected" : "excluded"}</td><td className="py-3">{item.reason}</td></tr>)}</tbody></table></div>
    </details>
  );
}
