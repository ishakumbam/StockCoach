"use client";

// CSV import flow: pick a file → preview parsed positions → confirm.

import { useRef, useState } from "react";
import { parseBrokerageCsv, type ImportedRow } from "@/lib/csv";
import { money, num } from "@/lib/format";

export function ImportCsv({ onImport }: { onImport: (rows: ImportedRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    const text = await file.text();
    const { rows, error: parseError } = parseBrokerageCsv(text);
    if (parseError) {
      setError(parseError);
      setPreview(null);
    } else {
      setPreview(rows);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
      >
        📄 Import CSV from your brokerage
      </button>
      <p className="mt-1.5 text-xs text-muted">
        Works with Schwab, Fidelity, Robinhood &amp; most brokerages: export your positions as CSV
        from their website, then upload it here. The file is read entirely in your browser — it is
        never uploaded to any server.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-4 fade-up">
          <p className="mb-2 text-sm font-medium">
            Found {preview.length} position{preview.length === 1 ? "" : "s"} — look right?
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Shares</th>
                  <th className="px-3 py-2">Avg cost/share</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.symbol} className="border-t border-line">
                    <td className="px-3 py-1.5 font-medium">{r.symbol}</td>
                    <td className="px-3 py-1.5">{num(r.shares, 4)}</td>
                    <td className="px-3 py-1.5">{r.costBasis != null ? money(r.costBasis) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                onImport(preview);
                setPreview(null);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-soft"
            >
              Add to my portfolio
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
