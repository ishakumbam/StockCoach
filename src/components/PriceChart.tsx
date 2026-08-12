"use client";

// Dependency-free SVG line chart with hover crosshair.

import { useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/types";
import { money } from "@/lib/format";

export function PriceChart({
  candles,
  height = 260,
  currency = "USD",
  intraday = false,
}: {
  candles: Candle[];
  height?: number;
  currency?: string;
  intraday?: boolean;
}) {
  const width = 800; // viewBox units; scales responsively
  const pad = { top: 12, right: 56, bottom: 22, left: 8 };
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const model = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || max * 0.01 || 1;
    const x = (i: number) =>
      pad.left + (i / (candles.length - 1)) * (width - pad.left - pad.right);
    const y = (v: number) =>
      pad.top + (1 - (v - min) / range) * (height - pad.top - pad.bottom);
    const path = closes.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `${path} L${x(candles.length - 1).toFixed(1)},${height - pad.bottom} L${pad.left},${height - pad.bottom} Z`;
    const up = closes[closes.length - 1] >= closes[0];
    return { closes, min, max, x, y, path, area, up };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, height]);

  if (!model) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-line bg-surface text-sm text-muted">
        Not enough price history to draw a chart.
      </div>
    );
  }

  const color = model.up ? "var(--up)" : "var(--down)";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const frac = (px - pad.left) / (width - pad.left - pad.right);
    const idx = Math.round(frac * (candles.length - 1));
    setHoverIdx(Math.max(0, Math.min(candles.length - 1, idx)));
  }

  const hover = hoverIdx != null ? candles[hoverIdx] : null;

  function fmtDate(t: number) {
    const d = new Date(t * 1000);
    return intraday
      ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => {
          const v = model.min + (model.max - model.min) * f;
          return (
            <g key={f}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={model.y(v)}
                y2={model.y(v)}
                stroke="var(--border)"
                strokeDasharray="3 5"
                strokeWidth="1"
              />
              <text x={width - pad.right + 6} y={model.y(v) + 4} fill="var(--muted)" fontSize="11">
                {money(v, currency)}
              </text>
            </g>
          );
        })}

        <path d={model.area} fill="url(#chartFill)" />
        <path d={model.path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {hover && hoverIdx != null && (
          <g>
            <line
              x1={model.x(hoverIdx)}
              x2={model.x(hoverIdx)}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle cx={model.x(hoverIdx)} cy={model.y(hover.close)} r="4" fill={color} />
          </g>
        )}

        <text x={pad.left} y={height - 6} fill="var(--muted)" fontSize="11">
          {fmtDate(candles[0].time)}
        </text>
        <text x={width - pad.right} y={height - 6} fill="var(--muted)" fontSize="11" textAnchor="end">
          {fmtDate(candles[candles.length - 1].time)}
        </text>
      </svg>

      {hover && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-line bg-surface-2/95 px-3 py-1.5 text-xs">
          <span className="font-medium">{money(hover.close, currency)}</span>
          <span className="ml-2 text-muted">{fmtDate(hover.time)}</span>
        </div>
      )}
    </div>
  );
}
