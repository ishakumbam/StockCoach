// Tiny inline trend line for table rows. Color follows the period's direction.

export function Sparkline({
  values,
  width = 96,
  height = 30,
}: {
  values: number[] | undefined;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) {
    return <div style={{ width, height }} className="rounded bg-surface-2/40" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg width={width} height={height} className="block" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
