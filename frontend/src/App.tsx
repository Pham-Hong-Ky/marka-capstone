import { useState, useEffect } from 'react';
import { Sparkles, Database, Server, Activity, Layers, ExternalLink } from 'lucide-react';
import httpClient from './services/httpClient';

interface HealthData {
  uptime: number;
  database: string;
  redis: string;
  version: string;
}

const TABLES = [
  'users', 'workspaces', 'workspace_members', 'workspace_invites',
  'brand_voices', 'posts', 'post_media', 'media_assets',
  'channel_connections', 'scheduled_posts', 'approval_histories', 'ai_generations',
  'credit_transactions', 'orders', 'notifications', 'refresh_tokens', 'audit_logs'
];

export function App() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    httpClient
      .get<{ data: HealthData }>('/health')
      .then((res) => setHealth(res.data.data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0e1017]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Marka Platform</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Scaffold Core
            </span>
          </div>

          <a
            href="http://localhost:5000/api-docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-850 border border-slate-750 transition"
          >
            <span>Swagger API Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Hạ tầng Khung Dự án Marka
          </h1>
          <p className="text-slate-400 text-sm">
            Kiến trúc phân tầng 1 chiều: Client → Router → Controller → Service → Repository → PostgreSQL.
          </p>
        </div>

        {/* Diagnostics Card */}
        <div className="p-6 rounded-2xl bg-[#11131c] border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Trạng thái Kết nối Hệ thống</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Express API Server</span>
                <Server className="w-4 h-4 text-slate-500" />
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-400">Port 5000 (Active)</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>PostgreSQL (Prisma)</span>
                <Database className="w-4 h-4 text-slate-500" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-200">
                {health?.database || '17 Bảng đã sẵn sàng'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>BullMQ & Redis</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-200">
                {health?.redis || '3 Queues đã khởi tạo'}
              </p>
            </div>
          </div>
        </div>

        {/* 17 Tables Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">17 Bảng Cơ Sở Dữ Liệu (schema.prisma)</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TABLES.map((table, idx) => (
              <div
                key={table}
                className="p-3 rounded-xl bg-[#11131c] border border-slate-800/80 flex items-center gap-2"
              >
                <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  #{idx + 1}
                </span>
                <span className="font-mono text-xs text-slate-300 truncate">{table}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Marka AI Platform &copy; 2026 — Clean Architecture Scaffold
      </footer>
    </div>
  );
}

export default App;
