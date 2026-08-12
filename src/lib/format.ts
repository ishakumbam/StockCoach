// Client-safe formatting helpers.

export function money(n: number | null | undefined, currency = "USD"): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function moneyCompact(n: number | null | undefined, currency = "USD"): string {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 10000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return money(n, currency);
}

export function pct(n: number | null | undefined, signed = true): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function num(n: number | null | undefined, digits = 2): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

export function changeColor(n: number | null | undefined): string {
  if (n == null || Math.abs(n) < 1e-9) return "text-zinc-400";
  return n > 0 ? "text-emerald-400" : "text-rose-400";
}

export function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 90) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}
