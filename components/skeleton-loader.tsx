'use client';

export function SkeletonCard() {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-5 w-28 rounded-full" />
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div><div className="skeleton h-3 w-10 mb-1" /><div className="skeleton h-5 w-24" /></div>
        <div><div className="skeleton h-3 w-10 mb-1" /><div className="skeleton h-5 w-20" /></div>
        <div><div className="skeleton h-3 w-10 mb-1" /><div className="skeleton h-5 w-16" /></div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading appointments">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-3">
          <div className="skeleton h-3 w-16 mb-2" />
          <div className="skeleton h-6 w-12" />
        </div>
      ))}
    </div>
  );
}
