import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type PageWidth = 'wide' | 'default' | 'narrow';

const widthClasses: Record<PageWidth, string> = {
  wide: 'max-w-7xl',
  default: 'max-w-5xl',
  narrow: 'max-w-3xl',
};

export const PageContainer = ({
  width = 'default',
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn('mx-auto w-full space-y-5', widthClasses[width], className)}>{children}</div>
);

export default PageContainer;
