import type { RankingResponse } from "@/types/ranking";

export function DebugPanel({ ranking }: { ranking: RankingResponse }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-stone-400">
      <summary className="cursor-pointer select-none uppercase tracking-[0.25em] text-stone-500">Developer debug · all cameras</summary>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[40rem] text-left"><thead className="text-xs uppercase tracking-wider text-stone-600"><tr><th className="pb-3">Camera</th><th className="pb-3">Elevation</th><th className="pb-3">Azimuth</th><th className="pb-3">Status</th><th className="pb-3">Reason</th></tr></thead><tbody>{ranking.debug.map((item) => <tr key={item.cameraId} className="border-t border-white/[0.06]"><td className="py-3 text-stone-300">{item.name}</td><td className="py-3 font-mono">{item.solarElevation.toFixed(2)}°</td><td className="py-3 font-mono">{item.solarAzimuth.toFixed(0)}°</td><td className={item.selected ? "py-3 text-orange-200" : "py-3 text-stone-600"}>{item.selected ? "selected" : "excluded"}</td><td className="py-3">{item.reason}</td></tr>)}</tbody></table></div>
    </details>
  );
}
