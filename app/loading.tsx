export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0b0a09] text-stone-100" aria-busy="true" aria-label="Finding current sunsets">
      <div className="mx-auto max-w-[96rem] px-5 py-7 sm:px-10 lg:px-14">
        <div className="h-5 w-44 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        <div className="mt-20 h-12 w-4/5 max-w-3xl animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        <div className="mt-5 h-7 w-64 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
        <div className="mt-14 aspect-video min-h-80 animate-pulse rounded-[2rem] bg-white/[0.055] motion-reduce:animate-none" />
      </div>
    </main>
  );
}
