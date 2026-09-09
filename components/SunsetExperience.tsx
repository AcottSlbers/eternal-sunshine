"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HeroSunset } from "@/components/HeroSunset";
import { Ranking } from "@/components/Ranking";
import { ZonedTime } from "@/components/LocalTime";
import { PUBLIC_RANKING_REFRESH_MINUTES } from "@/lib/config";
import type { PublicRankingResponse } from "@/types/public-ranking";

function isPublicRanking(value: unknown): value is PublicRankingResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicRankingResponse>;
  return typeof candidate.generatedAt === "string" && typeof candidate.totalCameras === "number"
    && typeof candidate.visibleCount === "number" && Array.isArray(candidate.results);
}

export function SunsetExperience({ initialRanking, initialError = false }: {
  initialRanking: PublicRankingResponse | null;
  initialError?: boolean;
}) {
  const [ranking, setRanking] = useState(initialRanking);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(initialError);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/public-ranking", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || !isPublicRanking(payload)) throw new Error("Ranking unavailable");
      setRanking(payload);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, PUBLIC_RANKING_REFRESH_MINUTES * 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selected = selectedCameraId
    ? [ranking?.rankedHero, ...(ranking?.results ?? [])].find((item) => item?.camera.id === selectedCameraId) ?? null
    : null;
  const viewed = selected ?? ranking?.rankedHero ?? null;
  const isUserSelected = Boolean(selected && selected.camera.id !== ranking?.rankedHero?.camera.id);

  function selectCamera(cameraId: string) {
    setSelectedCameraId(cameraId);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("current-sunset")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0a09] text-stone-100">
      <header className="mx-auto flex max-w-[96rem] items-center justify-between px-5 py-7 sm:px-10 lg:px-14">
        <a href="#top" className="focus-ring text-xs font-medium uppercase tracking-[0.28em] text-stone-100 sm:text-sm">Eternal Sunshine</a>
        <a href="#about" className="focus-ring text-xs text-stone-500 transition hover:text-stone-200">About</a>
      </header>

      <section id="top" className="mx-auto max-w-[96rem] px-5 pb-4 pt-14 sm:px-10 sm:pt-20 lg:px-14 lg:pt-24">
        <div className="mb-12 flex flex-col justify-between gap-7 sm:mb-16 lg:flex-row lg:items-end">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.34em] text-stone-500">Following sunset around the world</p>
            <h1 className="mt-5 max-w-5xl break-words font-serif text-[1.75rem] leading-[1.08] tracking-[-0.025em] text-stone-100 min-[420px]:text-4xl sm:text-6xl lg:text-7xl">Somewhere on Earth,<br /><span className="block max-w-full italic text-stone-400">the sun is always setting.</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
            {ranking && <span>{ranking.visibleCount} {ranking.visibleCount === 1 ? "sunset" : "sunsets"} visible now</span>}
            <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="focus-ring rounded-full border border-white/15 px-4 py-2 text-stone-300 transition hover:border-white/30 hover:text-white disabled:cursor-wait disabled:opacity-50">{isRefreshing ? "Checking…" : "Refresh"}</button>
          </div>
        </div>

        {refreshError && <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-4 text-sm text-stone-400"><span>{ranking ? "We couldn't refresh the view. The last result remains on screen." : "Current sunsets are temporarily out of view."}</span><button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="focus-ring text-xs uppercase tracking-[0.16em] text-stone-200 hover:text-white">Try again</button></div>}

        {viewed && ranking ? <HeroSunset key={`${viewed.camera.id}-${isUserSelected ? "selected" : "ranked"}`} item={viewed} generatedAt={ranking.generatedAt} isUserSelected={isUserSelected} onRestoreRanked={() => setSelectedCameraId(undefined)} /> : <EmptyHero />}
      </section>

      {ranking && <Ranking results={ranking.results} generatedAt={ranking.generatedAt} selectedCameraId={viewed?.camera.id} onSelect={selectCamera} />}

      <footer id="about" className="mx-auto mt-32 max-w-[96rem] border-t border-white/10 px-5 py-12 text-sm text-stone-500 sm:px-10 lg:px-14">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <p className="max-w-xl leading-7">Eternal Sunshine watches webcams around the world and finds places where the sun is setting right now.</p>
          <div className="text-left md:text-right">
            <p>Images from independent webcams. Source and attribution accompany each view.</p>
            {ranking && <p className="mt-2 text-xs text-stone-600">Watching {ranking.totalCameras} cameras · Last checked <ZonedTime dateTime={ranking.generatedAt} timeZone="UTC" /></p>}
          </div>
        </div>
      </footer>
    </main>
  );
}

function EmptyHero() {
  return (
    <section className="relative flex aspect-[4/5] min-h-[31rem] items-end overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_70%_25%,rgba(120,85,60,.16),transparent_35%),linear-gradient(150deg,#181613,#0d0c0b)] p-7 sm:aspect-[16/9] sm:min-h-[36rem] sm:rounded-[2rem] sm:p-12" aria-labelledby="empty-title">
      <div className="max-w-xl"><p className="text-[0.62rem] uppercase tracking-[0.3em] text-stone-500">Following the light</p><h2 id="empty-title" className="mt-4 font-serif text-3xl text-stone-100 sm:text-5xl">Searching for the next great sunset…</h2><p className="mt-5 leading-7 text-stone-400">The sunset line is moving across the planet. We’ll show the next visible one as soon as a camera catches it.</p></div>
    </section>
  );
}
