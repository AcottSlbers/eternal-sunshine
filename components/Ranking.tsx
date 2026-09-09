"use client";

import { ZonedTime } from "@/components/LocalTime";
import type { PublicSunset } from "@/types/public-ranking";
import { getCameraAttribution } from "@/lib/providers/attribution";

function freshnessLabel(age: number | undefined): string {
  if (age === undefined) return "Freshness unknown";
  if (age < 1) return "Updated now";
  if (age < 60) return `Updated ${Math.round(age)} min ago`;
  return `Updated ${Math.round(age / 60)}h ago`;
}

export function Ranking({ results, selectedCameraId, generatedAt, onSelect }: { results: PublicSunset[]; selectedCameraId?: string; generatedAt: string; onSelect: (cameraId: string) => void }) {
  if (results.length === 0) return null;
  return (
    <section className="mx-auto mt-28 max-w-[96rem] px-5 sm:px-10 lg:px-14" aria-labelledby="ranking-title">
      <div className="mb-9 flex items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div><p className="text-[0.62rem] uppercase tracking-[0.3em] text-stone-500">Around the world</p><h2 id="ranking-title" className="mt-3 font-serif text-3xl text-stone-100 sm:text-4xl">Best sunsets right now</h2></div>
        <p className="hidden text-sm text-stone-500 sm:block">Choose a view</p>
      </div>
      <ol className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((item, index) => {
          const camera = item.camera;
          const selected = camera.id === selectedCameraId;
          return <li key={camera.id}><button type="button" aria-pressed={selected} onClick={() => onSelect(camera.id)} className="focus-ring group block w-full text-left">
            <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#171512] transition duration-300 ${selected ? "ring-1 ring-stone-200/70" : "group-hover:opacity-90"}`}>
              {camera.previewUrl ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={camera.previewUrl} alt={`Current webcam view from ${camera.name}`} className="h-full w-full object-cover transition duration-500 motion-reduce:transition-none group-hover:scale-[1.015]" />
              </> : <div className="flex h-full items-center justify-center text-xs text-stone-600">Snapshot unavailable</div>}
              {camera.hasLiveStream && <span className="absolute left-4 top-4 rounded-full bg-black/70 px-2.5 py-1 text-[0.58rem] font-medium uppercase tracking-[0.18em] text-white">Live</span>}
              <span className="absolute bottom-4 left-4 text-xs font-medium tracking-[0.16em] text-white drop-shadow">#{index + 1}</span>
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="break-words text-lg leading-tight text-stone-100">{camera.name}</h3><p className="mt-1 text-sm text-stone-500">{camera.country ?? camera.region ?? "Location unavailable"}</p><p className="mt-3 text-xs text-stone-600"><ZonedTime dateTime={generatedAt} timeZone={item.cameraTimeZone} /> local · {freshnessLabel(item.imageAgeMinutes)}</p></div>
              <div className="shrink-0 text-right"><p className="font-serif text-3xl leading-none text-stone-100">{Math.floor(item.sunsetScore)}</p><p className="mt-1 text-[0.55rem] uppercase tracking-[0.16em] text-stone-600">Sunset score</p><p className="mt-1 text-[0.65rem] capitalize text-stone-500">{item.sunsetStrength}</p></div>
            </div>
          </button><p className="mt-3 text-xs text-stone-400">Source: <a className="focus-ring underline underline-offset-4" href={getCameraAttribution(camera).url} target="_blank" rel="noopener noreferrer">{getCameraAttribution(camera).name}</a>{camera.attribution?.licenseUrl && <> · <a className="focus-ring underline" href={camera.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">{camera.attribution.license}</a></>}</p></li>;
        })}
      </ol>
    </section>
  );
}
