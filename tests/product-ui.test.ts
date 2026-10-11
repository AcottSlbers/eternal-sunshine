import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HeroSunset } from "../components/HeroSunset";
import { SunsetExperience } from "../components/SunsetExperience";
import type { PublicRankingResponse, PublicSunset } from "../types/public-ranking";
import { PUBLIC_RANKING_REFRESH_MINUTES } from "../lib/config";
import { METEOGALICIA_ATTRIBUTION } from "../lib/providers/attribution";

vi.stubGlobal("React", React);

function sunset(overrides: Partial<PublicSunset["camera"]> = {}): PublicSunset {
  return {
    camera: {
      id: "cape-town",
      name: "Cape Town Atlantic Seaboard with a very long but wrapping camera name",
      country: "South Africa",
      source: "windy",
      sourceUrl: "https://windy.com/webcams/example",
      providerUrl: "https://example.com/camera",
      hasLiveStream: true,
      previewUrl: "https://images.example/cape-town.jpg",
      livePlayer: { type: "windy-iframe", url: "https://windy.com/webcams/example", embedUrl: "https://webcams.windy.com/webcams/public/embed/player/1" },
      ...overrides,
    },
    sunsetScore: 72.4,
    sunsetStrength: "strong",
    imageAgeMinutes: 4,
    cameraTimeZone: "Africa/Johannesburg",
  };
}

function ranking(rankedHero: PublicSunset | null, results: PublicSunset[] = rankedHero ? [rankedHero] : []): PublicRankingResponse {
  return { generatedAt: "2026-09-05T16:47:00Z", totalCameras: 300, visibleCount: results.length, rankedHero, results };
}

describe("cinematic public UI", () => {
  it("renders MeteoGalicia source and license attribution without Windy branding", () => {
    const item = sunset({ source: "meteogalicia", attribution: METEOGALICIA_ATTRIBUTION,
      sourceUrl: METEOGALICIA_ATTRIBUTION.url, providerUrl: METEOGALICIA_ATTRIBUTION.url, hasLiveStream: false, livePlayer: undefined });
    const html = renderToStaticMarkup(React.createElement(SunsetExperience, { initialRanking: ranking(item) }));
    expect(html).toContain("MeteoGalicia / Xunta de Galicia");
    expect(html).toContain("CC BY-SA 4.0");
    expect(html).not.toContain("Windy Webcams");
    expect(html).not.toContain("Watch live");
  });
  it("uses the centrally configured conservative refresh interval", () => {
    expect(PUBLIC_RANKING_REFRESH_MINUTES).toBe(10);
  });
  it("renders an image-first hero without public technical metrics or eager iframe loading", () => {
    const html = renderToStaticMarkup(React.createElement(SunsetExperience, { initialRanking: ranking(sunset()) }));
    expect(html).toContain("Best sunset right now");
    expect(html).toContain("Sunset score");
    expect(html).toContain("Watch live");
    expect(html).toContain("Original webcam");
    expect(html).toContain("Current webcam view from Cape Town");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("Evidence");
    expect(html).not.toContain("Opportunity");
    expect(html).not.toContain("Solar elevation");
    expect(html).not.toContain("Final score");
  });

  it("uses the external live fallback when no embeddable player exists", () => {
    const item = sunset({ livePlayer: { type: "external-link", url: "https://example.com/live" } });
    const html = renderToStaticMarkup(React.createElement(HeroSunset, { item, generatedAt: "2026-09-05T16:47:00Z", isUserSelected: false }));
    expect(html).toContain("href=\"https://example.com/live\"");
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("rel=\"noopener noreferrer\"");
    expect(html).not.toContain("<iframe");
  });

  it("falls back to Windy attribution when no live or provider URL exists", () => {
    const item = sunset({ hasLiveStream: false, livePlayer: undefined, providerUrl: undefined });
    const html = renderToStaticMarkup(React.createElement(HeroSunset, { item, generatedAt: "2026-09-05T16:47:00Z", isUserSelected: false }));
    expect(html).toContain("View on Windy");
    expect(html).not.toContain("Watch live");
  });

  it("shows the intentional empty and retry states without a weak hero", () => {
    const html = renderToStaticMarkup(React.createElement(SunsetExperience, { initialRanking: null, initialError: true }));
    expect(html).toContain("Searching for the next great sunset");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Best sunset right now");
  });

  it("uses the best credible card if a public response has no ranked hero", () => {
    const weak = sunset({ id: "twilight", name: "Visible twilight", hasLiveStream: false, livePlayer: undefined });
    weak.sunsetScore = 25;
    weak.sunsetStrength = "subtle";
    const html = renderToStaticMarkup(React.createElement(SunsetExperience, { initialRanking: ranking(null, [weak]) }));
    expect(html).not.toContain("Searching for the next great sunset");
    expect(html).toContain("Visible twilight");
    expect(html).toContain("Best sunset right now");
  });
});
