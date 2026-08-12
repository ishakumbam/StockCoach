"use client";

// Inline glossary tooltip: dotted-underlined term that reveals a beginner
// explanation on hover/tap.

import { useState } from "react";
import { glossaryEntry } from "@/lib/education";

export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = glossaryEntry(id);
  if (!entry) return <>{children}</>;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b border-dotted border-accent-soft/70 text-inherit"
      >
        {children}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface-2 p-3 text-left text-xs leading-relaxed text-foreground shadow-xl">
          <span className="mb-1 block font-semibold text-accent-soft">{entry.term}</span>
          {entry.short}
        </span>
      )}
    </span>
  );
}
