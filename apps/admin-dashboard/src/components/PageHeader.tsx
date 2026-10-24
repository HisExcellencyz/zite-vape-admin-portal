import { ReactNode } from 'react';

/**
 * Uniform sticky page header.
 * Row 1: title · summary tiles · actions. Row 2 (filled by <HeaderTools>): dates, search, sort, view toggle.
 */
export default function PageHeader({ title, subtitle, stats, children }: { title: string; subtitle?: string; stats?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header sticky top-0 z-30 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 py-3 mb-5 border-b space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-gradient">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>}
        </div>
        {stats && <div className="order-last xl:order-none w-full xl:w-auto xl:flex-1 flex gap-2 overflow-x-auto">{stats}</div>}
        {children && <div className="ml-auto flex flex-wrap items-center justify-end gap-2 [&_button]:h-9">{children}</div>}
      </div>
      <div id="page-header-tools" className="flex flex-wrap items-center gap-2 empty:hidden" />
    </div>
  );
}
