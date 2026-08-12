import type { StyleVerdict, VerdictAction } from "@/lib/types";

const STYLES: Record<VerdictAction, { label: string; cls: string }> = {
  buy: { label: "Leans BUY", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  hold: { label: "HOLD / wait", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  sell: { label: "Leans SELL", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: StyleVerdict;
  size?: "sm" | "md";
}) {
  const s = STYLES[verdict.action];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${s.cls} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      }`}
      title={verdict.headline}
    >
      {s.label}
      <span className="opacity-70">· {verdict.confidence} confidence</span>
    </span>
  );
}
