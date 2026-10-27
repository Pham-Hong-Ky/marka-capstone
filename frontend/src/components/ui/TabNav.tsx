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
  className,
}: {
  items: TabNavItem[];
  ariaLabel: string;
  className?: string;
}) => (
  <div className={cn('overflow-x-auto border-b border-border', className)}>
    <nav aria-label={ariaLabel} className="flex gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              '-mb-px min-h-11 shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              isActive
                ? 'border-accent text-accent-text'
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

export default TabNav;
