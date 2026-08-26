import { readFile } from "node:fs/promises";
import path from "node:path";

interface CoverageStats { cameraCount: number; averageStrict: number; medianStrict: number; minimumStrict: number; percentile5Strict: number; maximumStrict: number; slotsBelowStrictTarget: number; averageTotal: number; minimumTotal: number; slotsBelowTotalTarget: number }
interface CoverageReport {
  generatedAt: string; candidateCount: number; goldCount: number; countries: number; knownDirections: number; unknownDirections: number;
  quality: { minimum: number; average: number; median: number; percentile5: number; maximum: number; eligibleCount: number; minimumRequired: number };
  goldQuality: { minimum: number; average: number; median: number; percentile5: number; maximum: number };
  imageAnalysis: { analyzed: number; unavailable: number };
  registryComparisons: CoverageStats[]; recommendedSize: number;
  worstSlots: Array<{ timestamp: string; dateLabel: string; utcTime: string; strict: number; total: number; suggestions: Array<{ id: string; name: string; quality: number }> }>;
  heatmap: Array<{ dateLabel: string; utcTime: string; strict: number; total: number }>;
}

async function getReport(): Promise<CoverageReport | null> {
  try { return JSON.parse(await readFile(path.join(process.cwd(), "data", "coverage-report.json"), "utf8")) as CoverageReport; } catch { return null; }
}

const keyDates = ["Mar equinox", "Jun solstice", "Sep equinox", "Dec solstice"];

export default async function CoveragePage() {
  const report = await getReport();
  if (!report) return <main className="mx-auto min-h-screen max-w-5xl p-10"><h1 className="text-3xl">Coverage report unavailable</h1><p className="mt-4 text-stone-400">Run <code>npm run build-camera-registry</code> first.</p></main>;
  const heatmap = new Map(report.heatmap.map((slot) => [`${slot.dateLabel}/${slot.utcTime}`, slot]));
  const times = report.heatmap.filter((slot) => slot.dateLabel === keyDates[0]).map((slot) => slot.utcTime);
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 text-stone-200">
      <p className="text-xs uppercase tracking-[0.35em] text-orange-200/60">Development</p><h1 className="mt-3 text-4xl font-light">Sunset coverage</h1><p className="mt-3 text-sm text-stone-500">Generated {report.generatedAt} · recommended registry size: {report.recommendedSize}</p>
      <section className="mt-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[
        ["Candidates", report.candidateCount], ["Gold cameras", report.goldCount], ["Countries", report.countries], ["Known directions", report.knownDirections], ["Unknown directions", report.unknownDirections], ["Gold quality avg", report.goldQuality.average],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-2xl text-orange-100">{value}</p></div>)}</section>
      <section className="mt-12"><h2 className="text-2xl font-light">Registry size comparison</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-stone-500"><tr>{["Cameras", "Avg strict", "Median", "Minimum", "5th percentile", "Maximum", "Slots < 8", "Avg total", "Slots < 18"].map((heading) => <th key={heading} className="pb-3 pr-5">{heading}</th>)}</tr></thead><tbody>{report.registryComparisons.map((row) => <tr key={row.cameraCount} className="border-t border-white/10"><td className="py-3">{row.cameraCount}</td><td>{row.averageStrict}</td><td>{row.medianStrict}</td><td>{row.minimumStrict}</td><td>{row.percentile5Strict}</td><td>{row.maximumStrict}</td><td>{row.slotsBelowStrictTarget}</td><td>{row.averageTotal}</td><td>{row.slotsBelowTotalTarget}</td></tr>)}</tbody></table></div></section>
      <section className="mt-12"><h2 className="text-2xl font-light">Worst coverage slots</h2><div className="mt-5 grid gap-3 lg:grid-cols-2">{report.worstSlots.map((slot) => <article key={slot.timestamp} className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><div className="flex justify-between"><div><p>{slot.dateLabel} · {slot.utcTime} UTC</p><p className="mt-1 text-sm text-stone-500">{slot.timestamp.slice(0, 10)}</p></div><p className="text-right text-sm"><span className="text-orange-200">{slot.strict} strict</span><br />{slot.total} total</p></div><p className="mt-4 text-xs text-stone-500">Possible gap fillers</p><p className="mt-1 text-sm text-stone-400">{slot.suggestions.length ? slot.suggestions.map((camera) => `${camera.name} (${camera.quality})`).join(" · ") : "No eligible unselected camera covers this slot."}</p></article>)}</div></section>
      <section className="mt-12"><h2 className="text-2xl font-light">Seasonal strict coverage</h2><div className="mt-5 max-h-[40rem] overflow-auto rounded-xl border border-white/10"><table className="w-full text-center text-xs"><thead className="sticky top-0 bg-[#100e0d] text-stone-500"><tr><th className="p-2 text-left">UTC</th>{keyDates.map((date) => <th key={date} className="p-2">{date}</th>)}</tr></thead><tbody>{times.map((time) => <tr key={time} className="border-t border-white/5"><td className="p-2 text-left text-stone-500">{time}</td>{keyDates.map((date) => { const value = heatmap.get(`${date}/${time}`)?.strict ?? 0; return <td key={date} className={`p-2 ${value < 8 ? "bg-red-950/40 text-red-200" : value >= 12 ? "bg-emerald-950/30 text-emerald-200" : "text-amber-200"}`}>{value}</td>; })}</tr>)}</tbody></table></div></section>
    </main>
  );
}
