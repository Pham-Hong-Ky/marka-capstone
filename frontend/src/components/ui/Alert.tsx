import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type AlertVariant = 'info' | 'warning' | 'danger';

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-accent/20 bg-accent/5',
  warning: 'border-warning/30 bg-warning/10',
  danger: 'border-danger/30 bg-danger/10',
};

export const Alert = ({
  variant = 'info',
  title,
  action,
  className,
  children,
}: {
  variant?: AlertVariant;
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <div
    role={variant === 'info' ? 'status' : 'alert'}
    className={cn('rounded-xl border p-4 text-sm', variantClasses[variant], className)}
  >
    <div className="flex items-start gap-3">
      <div className="flex-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="text-muted">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  </div>
);

export default Alert;
