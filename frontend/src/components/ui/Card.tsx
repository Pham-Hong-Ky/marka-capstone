import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const Card = ({ className, ...props }: ComponentPropsWithoutRef<'section'>) => (
  <section className={cn('rounded-xl border border-border bg-surface', className)} {...props} />
);

export const CardHeader = ({
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
  <div className={cn('flex items-start justify-between gap-3 p-4', className)}>
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const CardBody = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('p-4 pt-0', className)} {...props} />
);

export default Card;
