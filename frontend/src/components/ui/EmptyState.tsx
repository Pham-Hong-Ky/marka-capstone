import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const EmptyState = ({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center',
      className
    )}
  >
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default EmptyState;
