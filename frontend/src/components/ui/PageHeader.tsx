import type { ReactNode } from 'react';

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
