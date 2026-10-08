import type { ReactNode } from 'react';
import BrandLogo from '@/components/shared/BrandLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center gap-3">
        <BrandLogo className="h-12 w-12 rounded-2xl" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">{children}</div>
    </div>
  </div>
);

export default AuthLayout;
