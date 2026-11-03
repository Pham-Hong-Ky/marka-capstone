import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const EmptyState = ({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center',
      className
    )}
  >
    {Icon ? (
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-muted">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
    ) : null}
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description ? <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
