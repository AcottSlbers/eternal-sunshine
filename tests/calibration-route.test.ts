import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CalibrationPage from "../app/dev/calibration/page";

const mocks = vi.hoisted(() => ({ ranking: vi.fn(), selector: vi.fn(), candidates: vi.fn(() => []) }));
vi.mock("../lib/ranking", () => ({ createRanking: mocks.ranking }));
vi.mock("../lib/public-ranking", () => ({ createHeroSelector: () => mocks.selector }));
vi.mock("../lib/calibration", () => ({ calibrationCandidates: mocks.candidates }));
vi.mock("../components/CalibrationWorkbench", () => ({ CalibrationWorkbench: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.stubGlobal("React", React);
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("calibration development boundary", () => {
  it("returns 404 in production before requesting any ranking or provider data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(CalibrationPage()).rejects.toThrow("404");
    expect(mocks.ranking).not.toHaveBeenCalled();
  });
  it("uses an isolated hero selector in development, never the shared public selector", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const ranking = { generatedAt: "2026-09-09T18:05:00Z", providerDiagnostics: {} };
    mocks.ranking.mockResolvedValue(ranking);
    await CalibrationPage();
    expect(mocks.ranking).toHaveBeenCalledExactlyOnceWith(expect.any(Date), mocks.selector);
    expect(mocks.candidates).toHaveBeenCalledExactlyOnceWith(ranking);
  });
});
