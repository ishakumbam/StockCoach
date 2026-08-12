// The StockCoach mark: a rising chart line breaking out of a rounded tile,
// with a little coach's-whistle dot. Pure SVG so it scales anywhere.

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="scg" x1="0" y1="48" x2="48" y2="0">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="scl" x1="8" y1="36" x2="40" y2="12">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#scg)" />
      <rect x="2" y="2" width="44" height="44" rx="13" fill="none" stroke="#ffffff" strokeOpacity="0.15" />
      {/* candlesticks */}
      <rect x="10" y="24" width="5" height="10" rx="1.5" fill="#ffffff" fillOpacity="0.35" />
      <rect x="19" y="19" width="5" height="15" rx="1.5" fill="#ffffff" fillOpacity="0.55" />
      <rect x="28" y="14" width="5" height="20" rx="1.5" fill="#ffffff" fillOpacity="0.75" />
      {/* breakout arrow */}
      <path
        d="M9 32 L18 24 L24 27.5 L37 13"
        stroke="url(#scl)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M30.5 12 L38 11.2 L37.2 18.7" stroke="url(#scl)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
