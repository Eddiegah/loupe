import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LoupeMark } from "@/components/LoupeMark";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Loupe";
const description = "A flight recorder for AI agents - trace every LLM call and tool call, compare runs side by side, and grade agent behavior against an eval suite.";
const url = "https://loupe-orcin.vercel.app";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(url),
  openGraph: { title, description, url, siteName: title, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/runs" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
              <LoupeMark />
              Loupe
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/runs" className="text-muted transition-colors hover:text-foreground">
                Runs
              </Link>
              <Link href="/evals" className="text-muted transition-colors hover:text-foreground">
                Evals
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
