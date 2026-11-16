import { BarChart3, CalendarClock, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import BrandLogo from '@/components/shared/BrandLogo';

const HIGHLIGHTS = [
  { icon: Sparkles, text: 'Viết đúng Brand Voice của workspace' },
  { icon: CalendarClock, text: 'Lên lịch và đăng đa kênh' },
  { icon: BarChart3, text: 'Theo dõi hiệu quả nội dung' },
];

export const AuthLayout = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen overflow-x-hidden bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
    <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3">
        <BrandLogo className="h-10 w-10 rounded-xl" />
        <span className="text-lg font-semibold tracking-tight">Marka</span>
      </div>

      <div className="max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-subtle">
          AI Marketing Platform
        </p>
        <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
          Nội dung đúng gu.
          <br />
          Đăng đúng kênh.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-sidebar-muted">
          Một workspace cho đội ngũ sáng tạo: soạn nội dung, duyệt bài, lên lịch và đọc số liệu
          trong cùng một chỗ.
        </p>

        <ul className="mt-8 space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[13px] text-sidebar-muted">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sidebar-hover text-sidebar-foreground">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-sidebar-subtle">Marka · Dành cho marketer Việt Nam</p>
    </aside>

    <main className="flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
      <div className="w-full min-w-0 max-w-sm">
        <div className="mb-8 lg:hidden">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-semibold tracking-tight">Marka</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>
        </div>

        {children}
      </div>
    </main>
  </div>
);

export default AuthLayout;
