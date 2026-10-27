import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/utils/cn';

export const Table = ({ className, children, ...props }: ComponentPropsWithoutRef<'table'>) => (
  <div className="w-full overflow-x-auto rounded-2xl border border-border bg-surface">
    <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
      {children}
    </table>
  </div>
);

export const THead = ({ className, ...props }: ComponentPropsWithoutRef<'thead'>) => (
  <thead className={cn('bg-surface-2 text-xs font-medium text-muted', className)} {...props} />
);

export const TBody = ({ className, ...props }: ComponentPropsWithoutRef<'tbody'>) => (
  <tbody className={cn('divide-y divide-border', className)} {...props} />
);

export const TR = ({ className, ...props }: ComponentPropsWithoutRef<'tr'>) => (
  <tr className={cn('transition hover:bg-surface-2/60', className)} {...props} />
);

export const TH = ({ className, ...props }: ComponentPropsWithoutRef<'th'>) => (
  <th className={cn('whitespace-nowrap px-4 py-3 font-medium', className)} {...props} />
);

export const TD = ({ className, ...props }: ComponentPropsWithoutRef<'td'>) => (
  <td className={cn('px-4 py-3 align-middle', className)} {...props} />
);

export default Table;
