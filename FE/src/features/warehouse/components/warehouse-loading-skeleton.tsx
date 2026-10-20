export function WarehouseLoadingSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "wms-wh-skeleton wms-wh-skeleton--compact" : "wms-wh-skeleton"} role="status" aria-label="Đang tải dữ liệu kho">
      {!compact ? (
        <>
          <div className="wms-wh-skeleton__head">
            <span className="wms-wh-skeleton__line wms-wh-skeleton__line--title" />
            <span className="wms-wh-skeleton__line wms-wh-skeleton__line--action" />
          </div>
          <span className="wms-wh-skeleton__line wms-wh-skeleton__line--tabs" />
        </>
      ) : null}
      <div className="wms-wh-skeleton__workspace">
        <div className="wms-wh-skeleton__viewer">
          <span className="wms-wh-skeleton__line wms-wh-skeleton__line--meta" />
          <div className="wms-wh-skeleton__scene">
            <span className="wms-wh-skeleton__rack" />
            <span className="wms-wh-skeleton__rack" />
            <span className="wms-wh-skeleton__rack" />
          </div>
        </div>
        <div className="wms-wh-skeleton__panel">
          <span className="wms-wh-skeleton__line wms-wh-skeleton__line--panel" />
          <span className="wms-wh-skeleton__line" />
          <span className="wms-wh-skeleton__line" />
          <span className="wms-wh-skeleton__line wms-wh-skeleton__line--short" />
        </div>
      </div>
      {!compact ? (
        <div className="wms-wh-skeleton__kpis">
          {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
        </div>
      ) : null}
    </div>
  );
}
