"use client";

// Header account widget: "Sign in" when logged out; avatar + dropdown
// (change avatar, sign out) when logged in.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AVATARS, avatarById } from "@/lib/avatars";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export function AuthMenu() {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPicking(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready || !supabase()) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-soft"
      >
        Sign in
      </Link>
    );
  }

  const avatar = avatarById(user.user_metadata?.avatar as string | undefined);

  async function pickAvatar(id: string) {
    setPicking(false);
    setOpen(false);
    await supabase()!.auth.updateUser({ data: { avatar: id } });
  }

  async function signOut() {
    await supabase()!.auth.signOut();
    setOpen(false);
    window.location.href = "/";
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={user.email ?? "Account"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg ring-1 ring-line transition hover:scale-105 hover:ring-accent"
        style={{ background: avatar.bg }}
      >
        {avatar.emoji}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-line bg-surface-2 p-3 shadow-2xl fade-up">
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
              style={{ background: avatar.bg }}
            >
              {avatar.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted">Portfolio synced to your account</p>
            </div>
          </div>

          {picking ? (
            <div className="pt-3">
              <p className="mb-2 text-xs text-muted">Choose your avatar</p>
              <div className="grid grid-cols-8 gap-1">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    title={a.label}
                    onClick={() => pickAvatar(a.id)}
                    className={`flex aspect-square items-center justify-center rounded-lg text-base transition hover:scale-110 ${
                      a.id === avatar.id ? "ring-2 ring-accent" : ""
                    }`}
                    style={{ background: a.bg }}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              <button
                onClick={() => setPicking(true)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-surface hover:text-foreground"
              >
                🎨 Change avatar
              </button>
              <button
                onClick={signOut}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-surface hover:text-rose-300"
              >
                👋 Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
