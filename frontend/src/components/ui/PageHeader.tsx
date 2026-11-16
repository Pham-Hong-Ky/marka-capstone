import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const PageHeader = ({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
    <div className="min-w-0 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
