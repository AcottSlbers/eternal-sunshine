"use client";

import { useState, useSyncExternalStore } from "react";
import { CALIBRATION_STORAGE_KEY, calibrationSummary, parseCalibration, saveComparison, sortCalibration } from "@/lib/calibration";
import type { CalibrationCandidate, CalibrationSort, HumanChoice } from "@/lib/calibration";
import type { RankingResponse } from "@/types/ranking";

const localEvent = "sunset-calibration-changed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(localEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(localEvent, callback); };
}
function readStorage() {
  try { return window.localStorage.getItem(CALIBRATION_STORAGE_KEY); }
  catch { return "Storage unavailable"; }
}
const serverStorage = () => null;
const buttonStyle = "rounded border border-stone-600 px-3 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-200 disabled:opacity-40";

function CandidateView({ candidate, label }: { candidate: CalibrationCandidate; label?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const s = candidate.snapshot;
  return <article className="min-w-0 rounded-xl border border-white/15 bg-white/[0.025] p-4">
    {label && <h3 className="mb-2 text-xl font-semibold">{label}</h3>}
    <h3 className="text-lg text-orange-100">{s.location}</h3>
    <p className="mb-3 break-all text-sm text-stone-400">{s.provider} · {s.cameraId}</p>
    <div className="flex aspect-video items-center justify-center overflow-hidden rounded bg-black">
      {candidate.previewUrl && !imageFailed ? <>
        {/* Direct provider preview, uncropped and never copied into calibration storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={candidate.previewUrl} alt={`Calibration view: ${s.location}`} className="h-full w-full object-contain" onError={() => setImageFailed(true)} />
      </> : <p className="p-4 text-stone-400">Preview unavailable. Do not judge this pair without seeing both images.</p>}
    </div>
    <p className="mt-2 text-xs text-stone-400">Source: <a href={candidate.attribution.url} target="_blank" rel="noopener noreferrer" className="underline">{candidate.attribution.name}</a>{candidate.attribution.licenseUrl && <> · <a href={candidate.attribution.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{candidate.attribution.license}</a></>}</p>
    <p className="mt-2 text-xs">Image timestamp: {s.imageTimestamp ?? "unknown"}</p>
    <dl className="my-4 grid grid-cols-4 gap-2">{[["Evidence", s.evidence], ["Beauty", s.beauty], ["SunsetScore", s.sunsetScore], ["FinalScore", s.finalScore]].map(([name, value]) => <div key={name}><dt className="text-xs text-stone-400">{name}</dt><dd className="text-xl">{Number(value).toFixed(1)}</dd></div>)}</dl>
    <p className="text-sm">Sunset phase: {s.phase.toFixed(1)} / 100 · {s.stage} · elevation {s.solarElevation.toFixed(2)}°</p>
    <p className="mt-2 text-sm text-orange-100">{s.visibility}: {s.reason}</p>
    {candidate.decision && <p className="mt-2 text-sm">primaryEvidencePath: {candidate.decision.primaryEvidencePath} · isCredibleSunset: {String(candidate.decision.isCredibleSunset)} · credibleSunsetReason: {candidate.decision.credibleSunsetReason}</p>}
    <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">{Object.entries(s.metrics).map(([name, value]) => <div key={name} className="contents"><dt className="break-all text-stone-400">{name}</dt><dd className="font-mono">{value.toFixed(name.endsWith("Ratio") || name === "estimatedHorizonY" ? 3 : 1)}</dd></div>)}</dl>
  </article>;
}

export function CalibrationWorkbench({ candidates, generatedAt, providers }: { candidates: CalibrationCandidate[]; generatedAt: string; providers: RankingResponse["providerDiagnostics"] }) {
  const [sort, setSort] = useState<CalibrationSort>("finalScore");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [message, setMessage] = useState("");
  const raw = useSyncExternalStore(subscribe, readStorage, serverStorage);
  let file = parseCalibration(null);
  let storageError = "";
  try { file = parseCalibration(raw); }
  catch { storageError = "Local storage is unavailable or contains invalid calibration JSON. Saving is disabled; existing data has not been overwritten."; }
  const summary = calibrationSummary(file.comparisons);
  const a = candidates.find((item) => item.snapshot.cameraId === aId);
  const b = candidates.find((item) => item.snapshot.cameraId === bId);
  const validPair = a && b && aId !== bId;

  function evaluate(choice: HumanChoice) {
    if (!a || !b || aId === bId || storageError) return;
    try {
      // Re-read before writing so another tab's latest completed evaluation is retained.
      const current = parseCalibration(window.localStorage.getItem(CALIBRATION_STORAGE_KEY));
      const next = saveComparison(current, { timestamp: new Date().toISOString(), rankingTimestamp: generatedAt,
        a: a.snapshot, b: b.snapshot, choice });
      window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(localEvent));
      setMessage(`Saved locally: ${choice === "a" ? "A is better" : choice === "b" ? "B is better" : choice === "equal" ? "roughly equal" : "neither is a sunset"}.`);
    } catch { setMessage("Could not save. Browser storage may be unavailable or full; no success was recorded."); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "sunset-calibration.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="mx-auto max-w-[100rem] space-y-8 px-4 py-10 text-stone-200 sm:px-8">
    <header><h1 className="text-3xl">Real-world sunset calibration</h1><p className="mt-3">Development only · measurements, not training. Public ranking is unaffected.</p>
      <p className="mt-2 text-sm text-stone-400">Scored at {generatedAt}. {candidates.length} analyzed candidates, including rejected and nearby-suppressed images.</p>
      <p className="mt-2 text-sm text-stone-400">Previews are current provider URLs, not archived scored frames: they may change or expire after analysis. Verify the image timestamp before judging. Reload manually for a new scoring snapshot; no automatic refresh.</p>
      <p className="mt-2 text-sm text-stone-400">Horizon Y and ratios: 0–1. Confidence, geometry and glow: 0–100. Preview pixels are never saved with feedback.</p>
    </header>
    <section aria-labelledby="provider-heading"><h2 id="provider-heading" className="text-xl">Provider diagnostics</h2><div className="mt-3 flex flex-wrap gap-6">{Object.entries(providers).map(([provider, counts]) => <p key={provider}><strong>{provider}</strong>: {counts.astronomical} astronomical · {counts.imagesAnalyzed} analyzed · {counts.visible} visible · {counts.featured} featured{counts.error && <span className="block text-red-300">{counts.error}</span>}</p>)}</div></section>
    <section aria-labelledby="summary-heading" className="rounded-xl border border-white/15 p-5"><h2 id="summary-heading" className="text-xl">Local calibration summary</h2>
      <p className="mt-3">{summary.count} human comparisons · Higher SunsetScore matched preference: {summary.agreementPercent === null ? "N/A" : `${summary.agreementPercent.toFixed(1)}%`} ({summary.matched}/{summary.preferences})</p>
      <p className="mt-2">False-positive images: {summary.falsePositives} · Neither is a sunset: {summary.neither}</p>
      <p className="mt-2 text-sm text-stone-400">Agreement uses A/B preferences only; equal/neither are excluded. Score ties do not match a strict preference ({summary.scoreTies} ties). False positives are unique visible/featured camera frames explicitly labeled “neither”; a lower preference alone is not a false positive. Rejudging the same pair in this snapshot replaces its previous choice.</p>
      <p className="mt-2 text-sm text-stone-400">Stored only in this browser/origin as versioned localStorage JSON. Clearing browser data removes evaluations; export a backup. No feedback is sent to a server.</p>
      {storageError && <p role="alert" className="mt-3 text-red-300">{storageError}</p>}
      <button type="button" className={`${buttonStyle} mt-4`} disabled={!!storageError} onClick={download}>Export local JSON</button>
    </section>
    <section aria-labelledby="pair-heading"><h2 id="pair-heading" className="text-2xl">Camera A vs Camera B</h2>
      <div className="my-4 flex flex-wrap gap-4">{(["a", "b"] as const).map((side) => <label key={side} className="min-w-0 flex-1">Camera {side.toUpperCase()}<select className="mt-2 block w-full rounded border border-stone-600 bg-stone-950 p-3" value={side === "a" ? aId : bId} onChange={(event) => { (side === "a" ? setAId : setBId)(event.target.value); setMessage(""); }}><option value="">Select a camera</option>{candidates.map((item) => <option key={item.snapshot.cameraId} value={item.snapshot.cameraId} disabled={item.snapshot.cameraId === (side === "a" ? bId : aId)}>{item.snapshot.provider} · {item.snapshot.location}</option>)}</select></label>)}</div>
      {validPair ? <div className="grid gap-5 md:grid-cols-2"><CandidateView key={`a-${aId}`} candidate={a} label="Camera A" /><CandidateView key={`b-${bId}`} candidate={b} label="Camera B" /></div> : <p>Select two different cameras to compare. {candidates.length < 2 && "Fewer than two analyzed candidates are currently available."}</p>}
      <div className="mt-4 flex flex-wrap gap-3">{([["a", "A is better"], ["b", "B is better"], ["equal", "Roughly equal"], ["neither", "Neither is a sunset"]] as const).map(([choice, label]) => <button key={choice} type="button" className={buttonStyle} disabled={!validPair || !!storageError} onClick={() => evaluate(choice)}>{label}</button>)}</div>
      <p role="status" className="mt-3">{message}</p>
    </section>
    <section aria-labelledby="candidates-heading"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="candidates-heading" className="text-2xl">All analyzed candidates</h2><label>Sort by <select className="ml-2 rounded border border-stone-600 bg-stone-950 p-2" value={sort} onChange={(event) => setSort(event.target.value as CalibrationSort)}><option value="finalScore">FinalScore</option><option value="sunsetScore">SunsetScore</option><option value="evidence">Evidence</option><option value="provider">Provider</option></select></label></div>
      {!candidates.length && <p>No analyzed astronomical candidates in this snapshot. Metadata/image failures and pre-analysis rejections do not have scores to compare.</p>}
      <div className="grid gap-5 lg:grid-cols-2">{sortCalibration(candidates, sort).map((candidate) => <CandidateView key={candidate.snapshot.cameraId} candidate={candidate} />)}</div>
    </section>
  </main>;
}
