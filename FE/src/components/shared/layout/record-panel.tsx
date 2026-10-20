import type { ReactNode } from "react";

export function RecordPanel({ title, toolbar, children }: {
  title: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-slot="record-panel">
      <header className="wms-record-panel__header">
        <h2>{title}</h2>
        {toolbar && <div className="wms-record-panel__toolbar">{toolbar}</div>}
      </header>
      <div className="min-h-0 min-w-0">{children}</div>
    </section>
  );
}
