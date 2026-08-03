import { Flame, FolderOpen, Blocks, Terminal } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0c10] flex items-center justify-center p-6 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <div className="max-w-xl w-full bg-white dark:bg-[#15161e] border border-slate-100 dark:border-[#222533] rounded-3xl p-8 shadow-xl space-y-8">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
            <Flame className="w-5 h-5 fill-brand-100 dark:fill-brand-500/20" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">
              Marka AI Platform
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">React + Express Boilerplate Ready</p>
          </div>
        </div>

        {/* Welcome Content */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Khung cấu trúc dự án đã được khởi tạo thành công!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Các thư mục rỗng và file cấu hình cho cả Frontend (Vite, React, TypeScript, TailwindCSS v4) và Backend (Node, Express, Prisma) đã sẵn sàng.
          </p>
        </div>

        {/* Structure checklist */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#1c1d27]/40 p-5 rounded-2xl border border-slate-100 dark:border-[#222533]/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4" />
            Cấu trúc thư mục hiện tại
          </h3>
          
          <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              <span><strong>backend/src/</strong>: config, controllers, middlewares, repositories, routes, services, validators, utils</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              <span><strong>backend/prisma/</strong>: schema.prisma (cơ sở dữ liệu SQLite)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              <span><strong>frontend/src/</strong>: assets, components (ui, shared, features), hooks, pages, services, stores, types, utils</span>
            </li>
          </ul>
        </div>

        {/* Tech Stack libraries loaded */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-[#1a1c26] border border-slate-100 dark:border-[#2b2e40] rounded-xl flex items-start gap-3">
            <Blocks className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Frontend Libs</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Router-dom, Zustand, TanStack Query, Axios, Lucide, Tailwind v4</p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-[#1a1c26] border border-slate-100 dark:border-[#2b2e40] rounded-xl flex items-start gap-3">
            <Terminal className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Backend Libs</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Express, Prisma client, Morgan, Helmet, Cors, Zod, Nodemon</p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Bắt đầu phát triển bằng cách tạo file và import tại các thư mục tương ứng.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
