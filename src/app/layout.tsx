import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
        <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-soft">
                📈
              </span>
              StockCoach
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/learn"
                className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Learn
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <div className="rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
            <strong className="text-foreground">Educational tool — not financial advice.</strong>{" "}
            StockCoach signals are computed from past price data only. Past performance never
            guarantees future results, and no tool can reliably predict stock prices. Do your own
            research and consider talking to a licensed financial advisor before investing real
            money. Market data via Yahoo Finance (may be delayed). Your portfolio is stored only in
            your browser — it never leaves your device.
          </div>
        </footer>
      </body>
    </html>
  );
}
