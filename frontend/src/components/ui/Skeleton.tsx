import { cn } from '@/utils/cn';

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-surface-2', className)} />
);

export const SkeletonList = ({ rows = 3, className }: { rows?: number; className?: string }) => (
  <div
    role="status"
    aria-label="Đang tải"
    className={cn('divide-y divide-border rounded-2xl border border-border bg-surface', className)}
  >
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center gap-4 px-5 py-4">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="hidden h-4 w-16 sm:block" />
      </div>
    ))}
  </div>
);

export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div role="status" aria-label="Đang tải" className={cn('space-y-3', className)}>
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export default Skeleton;
