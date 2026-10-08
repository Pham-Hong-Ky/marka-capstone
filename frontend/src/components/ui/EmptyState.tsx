import { cn } from '@/utils/cn';

export const EmptyState = ({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) => (
  <div
    className={cn('rounded-2xl border border-border bg-surface p-6 text-sm text-muted', className)}
  >
    <p>{title}</p>
    {description ? <p className="mt-1 text-xs text-subtle">{description}</p> : null}
  </div>
);

export default EmptyState;
