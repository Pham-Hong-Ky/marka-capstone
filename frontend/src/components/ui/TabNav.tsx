import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface TabNavItem {
  label: string;
  to: string;
  end?: boolean;
}

export const TabNav = ({
  items,
  ariaLabel,
  orientation = 'horizontal',
  className,
}: {
  items: TabNavItem[];
  ariaLabel: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) => {
  const vertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        vertical
          ? 'overflow-visible'
          : 'overflow-x-auto overflow-y-hidden border-b border-border',
        className
      )}
    >
      <nav
        aria-label={ariaLabel}
        className={cn('flex', vertical ? 'flex-col gap-1' : 'gap-1')}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                vertical
                  ? 'min-h-11 shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium transition'
                  : '-mb-px min-h-11 shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition',
                isActive
                  ? vertical
                    ? 'bg-accent/10 text-accent-text'
                    : 'border-accent text-accent-text'
                  : vertical
                    ? 'text-muted hover:bg-surface-2 hover:text-foreground'
                    : 'border-transparent text-muted hover:text-foreground'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default TabNav;
