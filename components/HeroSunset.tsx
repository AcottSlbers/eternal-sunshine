"use client";

import { useState } from "react";
import { ZonedTime } from "@/components/LocalTime";
import type { PublicSunset } from "@/types/public-ranking";
import { getCameraAttribution } from "@/lib/providers/attribution";

function isSafeWindyEmbedUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "windy.com" || url.hostname.endsWith(".windy.com"));
  } catch {
    return false;
  }
}

function freshnessLabel(age: number | undefined): string {
  if (age === undefined) return "Update time unavailable";
  if (age < 1) return "Updated just now";
  if (age < 60) return `Updated ${Math.round(age)} min ago`;
  const hours = Math.round(age / 60);
  return `Updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

export function HeroSunset({ item, isUserSelected, generatedAt, onRestoreRanked }: {
  item: PublicSunset;
  isUserSelected: boolean;
  generatedAt: string;
  onRestoreRanked?: () => void;
}) {
  const [showLive, setShowLive] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const camera = item.camera;
  const embedUrl = camera.livePlayer?.type === "windy-iframe" && isSafeWindyEmbedUrl(camera.livePlayer.embedUrl)
    ? camera.livePlayer.embedUrl
    : undefined;
  const externalLiveUrl = camera.livePlayer?.url;
  const attribution = getCameraAttribution(camera);

  function returnToSnapshot() {
    setShowLive(false);
    setLiveFailed(false);
  }

  return (
    <article id="current-sunset" className="hero-enter overflow-hidden rounded-[1.5rem] bg-[#12110f] shadow-[0_30px_100px_rgba(0,0,0,.42)] sm:rounded-[2rem]">
      <div className="relative aspect-[4/5] min-h-[31rem] overflow-hidden bg-[#171512] sm:aspect-[16/10] lg:aspect-[16/9] lg:max-h-[78vh] lg:min-h-[38rem]">
        {showLive && embedUrl ? (
          <iframe className="absolute inset-0 h-full w-full border-0 bg-black" src={embedUrl} title={`Live webcam from ${camera.name}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" onError={() => { setShowLive(false); setLiveFailed(true); }} />
        ) : camera.previewUrl && !imageFailed ? (
          // Native image loading keeps short-lived webcam URLs direct and avoids an optimization proxy cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={camera.previewUrl} alt={`Current webcam view from ${camera.name}`} className="absolute inset-0 h-full w-full object-cover" onError={() => setImageFailed(true)} />
        ) : <div className="absolute inset-0 flex items-center justify-center bg-[#171512] px-8 text-center text-sm text-stone-500">Current snapshot unavailable</div>}

        {!showLive && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/35 to-transparent" aria-hidden="true" />}
        {showLive && <div className="absolute left-5 top-5 z-10 rounded-full bg-red-700/90 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white">Live</div>}
        {!showLive && <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-9 lg:p-12">
          <div className="min-w-0">
            <p className="text-[0.62rem] uppercase tracking-[0.3em] text-stone-300 sm:text-xs">{isUserSelected ? "Selected sunset" : "Best sunset right now"}</p>
            <h2 className="mt-3 max-w-4xl break-words font-serif text-3xl leading-[1.02] text-white drop-shadow sm:text-5xl lg:text-6xl">{camera.name}</h2>
            <p className="mt-3 text-sm text-stone-300 sm:text-base">{[camera.region, camera.country].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex shrink-0 items-end gap-3 text-left sm:block sm:text-right">
            <p className="font-serif text-5xl leading-none text-white sm:text-7xl">{Math.floor(item.sunsetScore)}</p>
            <div><p className="text-[0.58rem] uppercase tracking-[0.24em] text-stone-300 sm:mt-2 sm:text-[0.65rem]">Sunset score</p><p className="mt-1 text-xs capitalize text-stone-400">{item.sunsetStrength}</p></div>
          </div>
        </div>}
      </div>

      <div className="flex flex-col gap-5 border-t border-white/[0.07] px-6 py-6 sm:flex-row sm:items-center sm:px-9 lg:px-12">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-400">
          <span><ZonedTime dateTime={generatedAt} timeZone={item.cameraTimeZone} /> local</span>
          <span>{freshnessLabel(item.imageAgeMinutes)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {embedUrl && <button type="button" onClick={() => showLive ? returnToSnapshot() : setShowLive(true)} className="focus-ring rounded-full bg-stone-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-white">{showLive ? "Back to current snapshot" : "Watch live"}</button>}
          {!embedUrl && camera.hasLiveStream && externalLiveUrl && <a className="focus-ring rounded-full bg-stone-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-white" href={externalLiveUrl} target="_blank" rel="noopener noreferrer">Watch live ↗</a>}
          {camera.providerUrl && <a className="focus-ring px-2 py-3 text-xs uppercase tracking-[0.14em] text-stone-300 hover:text-white" href={camera.providerUrl} target="_blank" rel="noopener noreferrer">Original webcam ↗</a>}
          {!camera.providerUrl && camera.sourceUrl && <a className="focus-ring px-2 py-3 text-xs uppercase tracking-[0.14em] text-stone-300 hover:text-white" href={camera.sourceUrl} target="_blank" rel="noopener noreferrer">View on {attribution.name.replace(" Webcams", "")} ↗</a>}
          {isUserSelected && onRestoreRanked && <button type="button" onClick={onRestoreRanked} className="focus-ring px-2 py-3 text-xs uppercase tracking-[0.14em] text-stone-400 hover:text-white">Return to best</button>}
        </div>
      </div>
      {liveFailed && <p role="status" className="border-t border-white/[0.07] px-6 py-3 text-xs text-stone-400 sm:px-9 lg:px-12">The live player could not be opened. The current snapshot is still available.</p>}
      <p className="border-t border-white/[0.07] px-6 py-3 text-[0.65rem] text-stone-400 sm:px-9 lg:px-12">Source: <a href={attribution.url} target="_blank" rel="noopener noreferrer" className="focus-ring underline underline-offset-4">{attribution.name}</a>{attribution.licenseUrl && <> · <a href={attribution.licenseUrl} target="_blank" rel="noopener noreferrer" className="focus-ring underline underline-offset-4">{attribution.license}</a> · Image displayed without color edits</>}.</p>
    </article>
  );
}
