import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Camera } from "@/types/camera";

export const dynamic = "force-dynamic";

type CameraFilter = "all" | "live" | "provider" | "snapshot";
const PAGE_SIZE = 100;

async function getCameras(): Promise<Camera[]> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", "cameras-reviewed.json"), "utf8")) as Camera[];
  } catch {
    return [];
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function matchesFilter(camera: Camera, filter: CameraFilter): boolean {
  if (filter === "live") return camera.hasLiveStream === true && Boolean(camera.livePlayer?.url);
  if (filter === "provider") return Boolean(camera.providerUrl);
  if (filter === "snapshot") return camera.hasLiveStream !== true || !camera.livePlayer?.url;
  return true;
}

export default async function CamerasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedFilter = firstParam(params.filter);
  const filter: CameraFilter = requestedFilter === "live" || requestedFilter === "provider" || requestedFilter === "snapshot" ? requestedFilter : "all";
  const requestedPage = Number(firstParam(params.page));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const cameras = (await getCameras()).filter((camera) => matchesFilter(camera, filter));
  const totalPages = Math.max(1, Math.ceil(cameras.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = cameras.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filters: Array<[CameraFilter, string]> = [["all", "All"], ["live", "Live only"], ["provider", "Has provider URL"], ["snapshot", "Snapshot only"]];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 text-stone-200">
      <p className="text-xs uppercase tracking-[0.35em] text-orange-200/60">Development</p>
      <h1 className="mt-3 text-4xl font-light">Camera capabilities</h1>
      <p className="mt-3 text-sm text-stone-500">Review normalized live and provider metadata without contacting provider websites.</p>
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Camera filters">
        {filters.map(([value, label]) => <a key={value} href={`/dev/cameras?filter=${value}`} className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wider ${filter === value ? "border-orange-200/50 bg-orange-200/10 text-orange-100" : "border-white/10 text-stone-500 hover:text-stone-300"}`}>{label}</a>)}
      </nav>
      <p className="mt-5 text-sm text-stone-500">{cameras.length} matching cameras · page {safePage} of {totalPages}</p>
      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        {visible.map((camera) => (
          <article key={camera.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-medium">{camera.name}</h2><p className="mt-1 text-sm text-stone-500">{camera.region ? `${camera.region}, ` : ""}{camera.country} · {camera.id}</p></div>
              {camera.hasLiveStream && <span className="rounded-full border border-red-300/30 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-red-200">Live</span>}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-white/10 pt-4 text-sm">
              <dt className="text-stone-500">Live</dt><dd className="text-right">{camera.hasLiveStream ? "Yes" : "No"}</dd>
              <dt className="text-stone-500">Provider URL</dt><dd className="text-right">{camera.providerUrl ? "Yes" : "No"}</dd>
              <dt className="text-stone-500">Player type</dt><dd className="text-right">{camera.livePlayer?.type ?? "—"}</dd>
              <dt className="text-stone-500">Quality</dt><dd className="text-right">{camera.review?.quality.score ?? "—"}</dd>
            </dl>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider">
              {camera.livePlayer?.url && <a className="text-red-200/70 hover:text-red-100" href={camera.livePlayer.url} target="_blank" rel="noopener noreferrer">Test player ↗</a>}
              {camera.providerUrl && <a className="text-orange-200/70 hover:text-orange-100" href={camera.providerUrl} target="_blank" rel="noopener noreferrer">Provider ↗</a>}
              {camera.sourceUrl && <a className="text-stone-500 hover:text-stone-300" href={camera.sourceUrl} target="_blank" rel="noopener noreferrer">Windy ↗</a>}
            </div>
          </article>
        ))}
      </section>
      <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
        {safePage > 1 ? <a className="text-orange-200/70 hover:text-orange-100" href={`/dev/cameras?filter=${filter}&page=${safePage - 1}`}>← Previous</a> : <span />}
        {safePage < totalPages && <a className="text-orange-200/70 hover:text-orange-100" href={`/dev/cameras?filter=${filter}&page=${safePage + 1}`}>Next →</a>}
      </nav>
    </main>
  );
}
