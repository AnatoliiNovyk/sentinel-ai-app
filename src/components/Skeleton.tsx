/** Reusable skeleton pulse block */
export function SkeletonBlock({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-800 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** 1–3 column skeleton grid of cards */
export function SkeletonCardGrid({
  cols = 3,
  count = 6,
  height = 'h-36',
}: {
  cols?: 1 | 2 | 3;
  count?: number;
  height?: string;
}) {
  const colClass = cols === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`grid ${colClass} gap-4`} aria-busy="true" aria-label="Loading…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-xl border border-slate-800 bg-slate-900/40 p-5 ${height} flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-5 w-14 rounded-md" />
          </div>
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Vertical list of skeleton rows */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 px-1">
          <SkeletonBlock className="h-4 w-4 rounded-full shrink-0" />
          <SkeletonBlock className="h-3 flex-1" />
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-5 w-14 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Sidebar scan list skeleton */
export function SkeletonSidebar({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-4 w-12 rounded-full" />
          </div>
          <SkeletonBlock className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
