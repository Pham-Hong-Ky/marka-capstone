import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type AlertVariant = 'info' | 'warning' | 'danger';

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-accent/20 bg-accent/5 text-accent-text',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

const variantIcons: Record<AlertVariant, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
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
}) => {
  const Icon = variantIcons[variant];

  return (
    <div
      role={variant === 'info' ? 'status' : 'alert'}
      className={cn('rounded-lg border p-3.5 text-[13px]', variantClasses[variant], className)}
    >
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium text-foreground">{title}</p> : null}
          <div className={cn('text-muted', title && 'mt-0.5')}>{children}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
};

export default Alert;
