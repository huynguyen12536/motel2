/** Material-outline style topbar icons with CSS micro-hover motion. */

export function TopbarMailIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="wms-top-icon wms-top-icon--mail"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8.5v9.2c0 .7.56 1.3 1.25 1.3h13.5c.69 0 1.25-.6 1.25-1.3V8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="wms-top-icon__flap"
        d="M4.2 8.4 12 13.6 19.8 8.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="wms-top-icon__flap-back"
        d="M4.2 8.4 12 4.8 19.8 8.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopbarBellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="wms-top-icon wms-top-icon--bell"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="wms-top-icon__bell-body"
        d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.2 1.4 5.4 1.4 5.4H5s1.4-1.2 1.4-5.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="wms-top-icon__bell-clapper"
        d="M10.2 18.2a1.8 1.8 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopbarMoonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="wms-top-icon wms-top-icon--moon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="wms-top-icon__moon-body"
        d="M16.8 14.2A6.6 6.6 0 0 1 9.8 7.2 6.7 6.7 0 1 0 16.8 14.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopbarSunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="wms-top-icon wms-top-icon--sun"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="wms-top-icon__sun-core"
        cx="12"
        cy="12"
        r="3.6"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <g className="wms-top-icon__sun-rays" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M12 3.4v2.1" />
        <path d="M12 18.5v2.1" />
        <path d="M3.4 12h2.1" />
        <path d="M18.5 12h2.1" />
        <path d="M5.9 5.9l1.5 1.5" />
        <path d="M16.6 16.6l1.5 1.5" />
        <path d="M5.9 18.1l1.5-1.5" />
        <path d="M16.6 7.4l1.5-1.5" />
      </g>
    </svg>
  );
}
