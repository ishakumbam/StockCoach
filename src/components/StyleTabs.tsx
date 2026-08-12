"use client";

import { TRADING_STYLES, type TradingStyle } from "@/lib/types";

export function StyleTabs({
  value,
  onChange,
}: {
  value: TradingStyle;
  onChange: (s: TradingStyle) => void;
}) {
  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
        {TRADING_STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              value === s.id
                ? "bg-accent/20 text-accent-soft"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {s.label}
            <span className="ml-1.5 hidden text-xs opacity-60 sm:inline">({s.horizon})</span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs leading-relaxed text-muted">
        {TRADING_STYLES.find((s) => s.id === value)?.blurb}
      </p>
    </div>
  );
}
