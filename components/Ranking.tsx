import { ZonedTime } from "@/components/LocalTime";
import { formatDirection } from "@/lib/camera-direction";
import type { RankedSunset, RankingResponse } from "@/types/ranking";

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return <><span className="text-stone-500">{label}</span><span className="text-right text-stone-300">{children}</span></>;
}

function CandidateCard({ item, index }: { item: RankedSunset; index: number }) {
  const imageTimestamp = item.camera.lastKnownImageTimestamp ?? item.camera.imageUpdatedAt;
  return (
    <li className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:border-orange-300/30 hover:bg-white/[0.055]">
      {item.camera.lastKnownImageUrl && <a href={item.camera.sourceUrl} target="_blank" rel="noreferrer" className="block h-48 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(item.camera.lastKnownImageUrl).slice(1, -1)})` }} aria-label={`Open ${item.camera.name} on Windy`} />}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div><span className="text-xs text-orange-200/50">{String(index + 1).padStart(2, "0")} · {item.stage}</span><h3 className="mt-2 text-xl font-medium">{item.camera.name}</h3><p className="mt-1 text-sm text-stone-500">{item.camera.region ? `${item.camera.region}, ` : ""}{item.camera.country}</p></div>
          <div className="text-right"><span className="text-3xl font-light text-orange-200">{item.scoreKind === "opportunity" ? item.sunsetOpportunityScore : item.temporaryMockScore}</span><p className="text-[0.6rem] uppercase tracking-widest text-stone-600">{item.scoreKind === "opportunity" ? "Opportunity" : "Mock score"}</p></div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-sm">
          <Metric label="Solar elevation"><span className="font-mono">{item.solarElevation.toFixed(2)}°</span></Metric>
          <Metric label="Sun direction"><span className="font-mono">{item.solarAzimuth.toFixed(0)}°</span></Metric>
          <Metric label="Camera direction">{formatDirection(item.cameraViewAzimuth)}{item.cameraViewAzimuth !== undefined && ` / ${item.cameraViewAzimuth.toFixed(0)}°`}</Metric>
          <Metric label="Alignment">{item.alignmentDifference === undefined ? `Neutral (${item.directionConfidence})` : `${item.alignmentDifference.toFixed(0)}° · ${item.sunAlignmentScore.toFixed(0)}/100`}</Metric>
          <Metric label="Sunset phase">{item.sunsetPhaseScore.toFixed(0)}/100</Metric>
          <Metric label="Camera local time"><ZonedTime dateTime={new Date().toISOString()} timeZone={item.cameraTimeZone} /></Metric>
          <Metric label="Image age">{item.imageAgeMinutes === undefined ? "Unknown" : `${item.imageAgeMinutes.toFixed(0)} min`}</Metric>
          <Metric label="Image viability">{item.imageViability.status === "unavailable" ? "Unchecked / neutral" : `${item.imageViability.viable ? "Viable" : "Rejected"} · ${item.imageViability.brightness.toFixed(0)}% light`}</Metric>
          {imageTimestamp && <Metric label="Image updated"><ZonedTime dateTime={imageTimestamp} timeZone={item.cameraTimeZone} /></Metric>}
          <Metric label="Opportunity">{item.sunsetOpportunityScore}/100</Metric>
        </div>
        {item.camera.sourceUrl && <a className="mt-5 inline-block text-xs uppercase tracking-wider text-orange-200/70 hover:text-orange-200" href={item.camera.sourceUrl} target="_blank" rel="noreferrer">View on Windy ↗</a>}
      </div>
    </li>
  );
}

export function Ranking({ ranking }: { ranking: RankingResponse }) {
  return (
    <section className="py-14" aria-labelledby="ranking-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-[0.65rem] uppercase tracking-[0.35em] text-orange-200/60">Right now</p><h2 id="ranking-title" className="text-2xl font-light tracking-tight sm:text-3xl">Sunset candidates</h2></div>
        <p className="text-sm text-stone-500">Known cameras: {ranking.totalCameras} · Sunset candidates: {ranking.candidatesEvaluated} · {ranking.selectionStage} window</p>
      </div>
      {ranking.results.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-stone-400">No viable sunset camera is available right now. Dark, stale, and badly aligned images are not used merely to fill the list.</div> : <ol className="grid gap-4 md:grid-cols-2">{ranking.results.map((item, index) => <CandidateCard key={item.camera.id} item={item} index={index} />)}</ol>}
      {ranking.results.length < ranking.minimumDesiredCandidates && <p className="mt-5 rounded-xl border border-amber-200/10 bg-amber-200/[0.03] p-4 text-sm text-amber-100/60">Only {ranking.results.length} viable candidates are available. The list is intentionally not padded with obvious night or stale images.</p>}
      <p className="mt-5 text-xs leading-relaxed text-stone-600">Opportunity estimates whether the camera can show the current sunset. It is not the later aesthetic SunsetScore.</p>
      <p className="mt-2 text-xs text-stone-600">Provider: {ranking.provider.mode}; refreshed {ranking.provider.refreshed} candidate records and checked {ranking.provider.imagesChecked} candidate images only.{ranking.provider.error && ` ${ranking.provider.error}`}</p>
    </section>
  );
}
