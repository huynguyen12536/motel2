import type { ComponentType, SVGProps } from "react";

export type MetricIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function IconFrame({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        className="wms-metric-icon__orbit"
        d="M27 16a11 11 0 0 1-11 11"
        stroke="currentColor"
        strokeOpacity=".32"
        strokeLinecap="round"
      />
      <path
        className="wms-metric-icon__orbit"
        d="M5 16A11 11 0 0 1 16 5"
        stroke="currentColor"
        strokeOpacity=".32"
        strokeLinecap="round"
      />
      {children}
    </svg>
  );
}

export function MaterialsMetricIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <g className="wms-metric-icon__core" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round">
        <path d="m16 9 6 3.35v7.25L16 23l-6-3.4v-7.25L16 9Z" />
        <path d="m10 12.35 6 3.4 6-3.4M16 15.75V23" />
        <path className="wms-metric-icon__signal" d="m13 10.7 6 3.4" strokeOpacity=".45" />
      </g>
    </IconFrame>
  );
}

export function InboundMetricIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <g className="wms-metric-icon__core" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 14v8h12V10h-6" />
        <path className="wms-metric-icon__signal" d="M7 10h9m0 0-3-3m3 3-3 3" />
        <path d="M14 18h6M14 21h4" strokeOpacity=".55" />
      </g>
    </IconFrame>
  );
}

export function QuarantineMetricIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <g className="wms-metric-icon__core" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8.5 22 11v5.3c0 3.65-2.45 6.35-6 7.2-3.55-.85-6-3.55-6-7.2V11l6-2.5Z" />
        <path className="wms-metric-icon__signal" d="M16 12v5" />
        <path d="M16 20h.01" strokeWidth="2.1" />
      </g>
    </IconFrame>
  );
}

export function ExpiryMetricIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <g className="wms-metric-icon__core" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h14v11H9zM12 9v5M20 9v5M9 16h14" />
        <circle cx="18.5" cy="19.5" r="2.5" />
        <path className="wms-metric-icon__signal" d="M18.5 18v1.7l1.2.7" />
      </g>
    </IconFrame>
  );
}
