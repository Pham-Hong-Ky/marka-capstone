import { Activity, Database, Layers, Server } from 'lucide-react';
import { useHealth } from '@/hooks/useHealth';
import { useCurrentUser } from '@/hooks/useAuth';

const TABLES = [
  'users',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'posts',
  'media_assets',
  'channel_connections',
  'scheduled_posts',
  'ai_generations',
  'credit_transactions',
  'credit_packages',
  'orders',
  'notifications',
  'audit_logs',
];

const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const DashboardPage = () => {
  const { data: health, isLoading } = useHealth();
  const { data: user } = useCurrentUser();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Xin chào, {user?.name ?? 'bạn'} 👋
        </h1>
        <p className="text-sm text-muted">
          Kiến trúc phân tầng: Client → Router → Controller → Service → PostgreSQL.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-foreground">Trạng thái kết nối hệ thống</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Máy chủ API Express</span>
              <Server className="h-4 w-4 text-subtle" />
            </div>
            <p className="mt-2 text-sm font-semibold text-emerald-400">
              {isLoading ? 'Đang kiểm tra...' : `Cổng 5000 · uptime ${health ? formatUptime(health.uptime) : '—'}`}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>PostgreSQL (Prisma)</span>
              <Database className="h-4 w-4 text-subtle" />
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {health?.database === 'connected'
                ? 'Đã kết nối thành công'
                : health?.database === 'error'
                  ? 'Lỗi kết nối cơ sở dữ liệu'
                  : '14 bảng đã sẵn sàng'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Hàng đợi BullMQ & Redis</span>
              <Layers className="h-4 w-4 text-subtle" />
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {health?.redis === 'connected'
                ? 'Đã kết nối thành công'
                : health?.redis === 'error'
                  ? 'Lỗi kết nối Redis'
                  : '3 hàng đợi đã khởi tạo'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-foreground">
            14 bảng cơ sở dữ liệu (schema.prisma)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TABLES.map((table, index) => (
            <div
              key={table}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[11px] text-indigo-400">
                #{index + 1}
              </span>
              <span className="truncate font-mono text-xs text-foreground">{table}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
