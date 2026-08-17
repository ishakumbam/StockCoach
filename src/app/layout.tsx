import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthMenu } from "@/components/AuthMenu";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { NotificationBell } from "@/components/NotificationBell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StockCoach — learn stocks, track your portfolio",
  description:
    "A beginner-friendly portfolio tracker that explains every signal in plain English. Educational only — not financial advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}>
        <header className="sticky top-0 z-40 border-b border-line/70 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="drop-shadow-[0_4px_12px_rgba(99,102,241,0.45)] transition group-hover:scale-105">
                <Logo size={34} />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                StockCoach
                <span className="ml-2 hidden rounded-full border border-line px-2 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted md:inline">
                  Educational
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <NavLinks />
              <NotificationBell />
              <AuthMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
          <div className="rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-muted">
            <strong className="text-foreground">Educational tool — not financial advice.</strong>{" "}
            StockCoach signals are computed from past price data only. Past performance never
            guarantees future results, and no tool can reliably predict stock prices. Do your own
            research and consider talking to a licensed financial advisor before investing real
            money. Market data via Yahoo Finance / CBOE (delayed up to ~15 minutes). Your portfolio
            is stored only in your browser — it never leaves your device.
          </div>
        </footer>
      </body>
    </html>
  );
}
