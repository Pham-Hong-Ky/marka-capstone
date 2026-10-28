import type { ReactNode } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { cn } from '@/utils/cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  hideBelow?: 'sm' | 'md' | 'lg';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  error?: ReactNode;
  empty?: ReactNode;
  renderMobileCard?: (row: T) => ReactNode;
  className?: string;
}

const hideBelowClasses = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const satisfies Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string>;

export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  error,
  empty,
  renderMobileCard,
  className,
}: DataTableProps<T>) => {
  if (isLoading) {
    return <SkeletonList rows={5} className={className} />;
  }

  if (error) {
    return <>{error}</>;
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Chưa có dữ liệu." className={className} />}</>;
  }

  const renderDefaultMobileCard = (row: T) => (
    <dl className="space-y-2 text-sm">
      {columns.map((column) => (
        <div key={column.key} className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-2">
          <dt className="text-muted">{column.header}</dt>
          <dd className={cn('min-w-0', column.className)}>{column.cell(row)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className={className}>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              {columns.map((column) => (
                <TH
                  key={column.key}
                  scope="col"
                  className={cn(
                    column.hideBelow && hideBelowClasses[column.hideBelow],
                    column.headerClassName
                  )}
                >
                  {column.header}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={getRowKey(row)}>
                {columns.map((column) => (
                  <TD
                    key={column.key}
                    className={cn(column.hideBelow && hideBelowClasses[column.hideBelow], column.className)}
                  >
                    {column.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={getRowKey(row)} className="rounded-2xl border border-border bg-surface p-4">
            {renderMobileCard ? renderMobileCard(row) : renderDefaultMobileCard(row)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataTable;
