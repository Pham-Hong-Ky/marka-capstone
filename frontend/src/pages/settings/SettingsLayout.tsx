import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/utils/cn';

const SETTINGS_TABS = [
  { label: 'Giao diện', to: '/settings/appearance' },
  { label: 'Workspace', to: '/settings/workspace' },
  { label: 'Thành viên', to: '/settings/members' },
];

export const SettingsLayout = () => (
  <div className="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Cài đặt</h1>
      <p className="mt-1 text-sm text-muted">Quản lý giao diện, workspace và thành viên.</p>
    </div>

    <div className="flex gap-1 border-b border-border">
      {SETTINGS_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition',
              isActive
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted hover:text-foreground'
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>

    <Outlet />
  </div>
);

export default SettingsLayout;
