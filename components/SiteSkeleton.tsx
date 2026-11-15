/** A website-shaped loading placeholder for the vote windows. */
export function SiteSkeleton({ label }: { label?: string }) {
  const bar = "rounded-md bg-stone-200/80";
  return (
    <div className="absolute inset-0 overflow-hidden bg-white" aria-busy="true" aria-label={label ?? "Loading website"}>
      <div className="animate-pulse">
        {/* nav */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className={`${bar} h-6 w-28`} />
          <div className="hidden gap-4 sm:flex">
            <div className={`${bar} h-3 w-14`} />
            <div className={`${bar} h-3 w-14`} />
            <div className={`${bar} h-3 w-14`} />
          </div>
          <div className={`${bar} h-8 w-24 rounded-full`} />
        </div>
        {/* hero */}
        <div className="flex flex-col items-center gap-3 px-6 pt-14 pb-10">
          <div className={`${bar} h-8 w-3/4 max-w-lg`} />
          <div className={`${bar} h-8 w-1/2 max-w-sm`} />
          <div className={`${bar} mt-3 h-3 w-2/3 max-w-md`} />
          <div className={`${bar} h-3 w-1/2 max-w-sm`} />
          <div className="mt-5 flex gap-3">
            <div className={`${bar} h-10 w-32 rounded-full`} />
            <div className={`${bar} h-10 w-32 rounded-full`} />
          </div>
        </div>
        {/* image block */}
        <div className={`${bar} mx-6 h-44 rounded-2xl`} />
        {/* cards */}
        <div className="grid grid-cols-3 gap-4 px-6 py-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className={`${bar} h-24 rounded-xl`} />
              <div className={`${bar} h-3 w-3/4`} />
              <div className={`${bar} h-3 w-1/2`} />
            </div>
          ))}
        </div>
      </div>
      {label && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-muted shadow-sm">{label}</span>
        </div>
      )}
    </div>
  );
}
