import { SiteSkeleton } from "@/components/SiteSkeleton";

/** Full-screen placeholder shaped like the vote screen, shown instantly while the matchup loads. */
export function ArenaSkeleton() {
  const bar = "animate-pulse rounded-md bg-stone-200/80";
  const header = (
    <div className="flex h-16 items-center justify-end gap-3 px-4">
      <div className="flex flex-col items-end gap-1.5">
        <div className={`${bar} h-3 w-24`} />
        <div className={`${bar} h-2.5 w-16`} />
      </div>
      <div className={`${bar} h-9 w-9 rounded-lg`} />
      <div className={`${bar} h-6 w-8`} />
      <div className={`${bar} h-10 w-20 rounded-lg`} />
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="px-2 text-lg text-muted">←</span>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <div className={`${bar} h-2.5 w-56`} />
          <div className={`${bar} h-2 w-full max-w-md rounded-full`} />
        </div>
        <div className={`${bar} h-8 w-16 rounded-lg`} />
      </div>
      <div className="hidden shrink-0 grid-cols-2 border-b border-line md:grid">
        {header}
        <div className="border-l border-line">{header}</div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-line p-2 md:hidden">
        <div className={`${bar} h-10`} />
        <div className={`${bar} h-10`} />
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex-1">
          <SiteSkeleton />
        </div>
        <div className="relative hidden flex-1 border-l border-line md:block">
          <SiteSkeleton />
        </div>
      </div>
    </div>
  );
}
