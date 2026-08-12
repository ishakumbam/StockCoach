"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { AVATARS } from "@/lib/avatars";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  const sb = supabase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { avatar },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (err) throw err;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setVerifySent(true);
          return;
        }
        router.push("/");
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        message.includes("Email not confirmed")
          ? "Your email isn't verified yet — check your inbox for the confirmation link."
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!sb) return;
    setBusy(true);
    try {
      await sb.auth.resend({ type: "signup", email });
    } finally {
      setBusy(false);
    }
  }

  if (!sb) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
        Accounts aren&apos;t configured on this deployment. Your portfolio still works — it&apos;s
        saved privately in this browser.
      </div>
    );
  }

  if (verifySent) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-3xl">
          📬
        </div>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          We sent a verification link to <strong className="text-foreground">{email}</strong>.
          Click it to activate your account, then come back and sign in.
        </p>
        <button
          onClick={resend}
          disabled={busy}
          className="mt-5 rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Resend email"}
        </button>
        <p className="mt-4 text-xs text-muted">
          Wrong address?{" "}
          <button onClick={() => setVerifySent(false)} className="text-accent-soft underline">
            Go back
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md fade-up">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <div className="mb-6 text-center">
          <span className="inline-block drop-shadow-[0_8px_24px_rgba(99,102,241,0.45)]">
            <Logo size={48} />
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin"
              ? "Sign in to your private portfolio."
              : "Your portfolio stays private to you, synced across devices."}
          </p>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl border border-line bg-surface-2/50 p-1 text-sm">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${
                mode === m ? "bg-accent/20 text-accent-soft" : "text-muted hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs text-muted">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>

          {mode === "signup" && (
            <div>
              <p className="mb-2 text-xs text-muted">Pick your avatar</p>
              <div className="grid grid-cols-8 gap-1.5">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.label}
                    onClick={() => setAvatar(a.id)}
                    className={`flex aspect-square items-center justify-center rounded-xl text-xl transition ${
                      avatar === a.id
                        ? "scale-110 ring-2 ring-accent"
                        : "opacity-70 hover:scale-105 hover:opacity-100"
                    }`}
                    style={{ background: a.bg }}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
            We&apos;ll send a verification link to your email. You stay signed in on this device
            until you sign out.
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Just browsing?{" "}
        <Link href="/" className="text-accent-soft underline underline-offset-2">
          Use StockCoach without an account
        </Link>{" "}
        — your portfolio stays in this browser.
      </p>
    </div>
  );
}
