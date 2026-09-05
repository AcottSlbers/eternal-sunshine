"use client";

import { useState } from "react";
import type { RankedSunset } from "@/types/ranking";

function isSafeWindyEmbedUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "windy.com" || url.hostname.endsWith(".windy.com"));
  } catch {
    return false;
  }
}

export function HeroSunset({ item }: { item: RankedSunset }) {
  const [showLive, setShowLive] = useState(false);
  const camera = item.camera;
  const previewUrl = camera.lastKnownImageUrl ?? camera.imageUrl;
  const embedUrl = camera.livePlayer?.type === "windy-iframe" && isSafeWindyEmbedUrl(camera.livePlayer.embedUrl)
    ? camera.livePlayer.embedUrl
    : undefined;
  const externalLiveUrl = camera.livePlayer?.url;

  return (
    <article className="mb-12 overflow-hidden rounded-3xl border border-orange-200/15 bg-black/30 shadow-2xl shadow-black/30">
      <div className="relative aspect-video min-h-72 overflow-hidden bg-stone-950">
        {showLive && embedUrl ? (
          <iframe
            className="absolute inset-0 h-full w-full border-0"
            src={embedUrl}
            title={`Live webcam: ${camera.name}`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={previewUrl ? { backgroundImage: `linear-gradient(to top, rgba(8, 7, 6, .82), rgba(8, 7, 6, .08) 65%), url(${JSON.stringify(previewUrl)})` } : undefined}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-orange-100/70">Best sunset right now</p>
            {camera.hasLiveStream && <span className="rounded-full border border-red-300/40 bg-red-950/65 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-red-100">Live available</span>}
          </div>
          <h2 className="mt-3 max-w-3xl text-3xl font-light text-white drop-shadow sm:text-5xl">{camera.name}</h2>
          <p className="mt-2 text-sm text-stone-300">{camera.region ? `${camera.region}, ` : ""}{camera.country}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-5 sm:px-8 sm:py-6">
        {embedUrl && (
          <button
            type="button"
            onClick={() => setShowLive((value) => !value)}
            className="rounded-full bg-orange-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-stone-950 transition hover:bg-white"
          >
            {showLive ? "Back to preview" : "Watch live"}
          </button>
        )}
        {!embedUrl && externalLiveUrl && (
          <a className="rounded-full bg-orange-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-stone-950 transition hover:bg-white" href={externalLiveUrl} target="_blank" rel="noopener noreferrer">Open live webcam ↗</a>
        )}
        {camera.providerUrl && <a className="text-xs uppercase tracking-[0.16em] text-orange-100/70 hover:text-orange-100" href={camera.providerUrl} target="_blank" rel="noopener noreferrer">Original webcam ↗</a>}
        {camera.sourceUrl && <a className="text-xs uppercase tracking-[0.16em] text-stone-500 hover:text-stone-300" href={camera.sourceUrl} target="_blank" rel="noopener noreferrer">View on Windy ↗</a>}
        <p className="ml-auto text-xs text-stone-500">Sunset {item.sunsetScore.toFixed(1)}/100 · Final {item.finalScore.toFixed(1)}/100 · Solar elevation {item.solarElevation.toFixed(2)}°</p>
      </div>
    </article>
  );
}
