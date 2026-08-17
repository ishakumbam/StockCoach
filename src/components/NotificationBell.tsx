"use client";

// Header bell: unread badge + dropdown feed of the user's notifications.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  symbol: string | null;
  kind: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    if (!sb || !user) return;
    const { data } = await sb
      .from("notifications")
      .select("id,title,body,symbol,kind,read,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as NotificationRow[]);
  }, [user]);

  useEffect(() => {
    if (!ready || !user) return;
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [ready, user, load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready || !user || !supabase()) return null;

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    const sb = supabase();
    if (!sb) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await sb.from("notifications").update({ read: true }).eq("read", false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) void markAllRead();
        }}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-base ring-1 ring-line transition hover:ring-accent"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-surface-2 shadow-2xl fade-up">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-accent-soft underline underline-offset-2"
            >
              Manage alerts
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs leading-relaxed text-muted">
                Nothing yet. You&apos;ll hear from us when one of your stocks makes a big move,
                hits a price target, or flips its signal.
              </p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.symbol ? `/stock/${n.symbol}` : "/picks"}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line/60 px-4 py-3 transition last:border-0 hover:bg-surface"
                >
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted/70">
                    {timeAgo(new Date(n.created_at).getTime() / 1000)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
