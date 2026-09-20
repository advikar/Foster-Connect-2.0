import { useEffect, useRef, useState } from "react";
import { applyAccent, currentAccent } from "@/lib/accent";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bookmark, Home, ListChecks, MessageCircle, Search } from "lucide-react";
import { NovaProvider } from "@/contexts/NovaContext";
import { CrisisButton } from "@/components/safety/CrisisBar";
import { QuickExit } from "@/components/safety/QuickExit";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/resources", label: "Find", icon: Search },
  { path: "/ask", label: "Ask", icon: MessageCircle },
  { path: "/roadmap", label: "My plan", icon: ListChecks },
  { path: "/saved", label: "Saved", icon: Bookmark },
];

/**
 * Youth shell (September 2026 redesign).
 *
 *   Phone   — 56px header (brand, Need help now, Quick exit), five-tab bar.
 *   Desktop — 64px header with underline navigation, utilities on the right.
 *
 * Quick exit and Need help now are always visible and never behind a menu.
 * The crisis numbers are also printed as plain text in the footer of every
 * page, from compiled-in constants, so they survive every failure mode.
 */
export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <NovaProvider>
      <div className="flex min-h-screen flex-col bg-ground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <TopBar />

        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 pb-24 pt-14 outline-none lg:pb-0 lg:pt-16">
          <Outlet />
        </main>

        <SiteFooter />

        <nav
          aria-label="Primary"
          className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-surface lg:hidden"
        >
          {tabs.map(tab => <TabBarItem key={tab.path} {...tab} active={tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path)} />)}
        </nav>
      </div>
    </NovaProvider>
  );
}

/**
 * The mark (U2, redrawn in round 2): two hands clasped into a heart, on the
 * brand circle. Built the way the reference is: a white heart silhouette,
 * the near hand's thumb outlined over the far arm's seam, three finger gaps
 * fanning to the lower right, and the far hand's knuckles scalloping the
 * lower-left edge. Strokes take the accent colour, so it follows the token.
 */
export function Mark({ className = "size-[30px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="16" fill="var(--brand)" />
      <path d={HEART} fill="#FFFFFF" />
      {KNUCKLES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#FFFFFF" />)}
      <g fill="none" stroke="var(--brand)" strokeLinecap="round" strokeLinejoin="round">
        <path d={THUMB_AND_SEAM} strokeWidth="2.2" />
        <path d={FINGERS} strokeWidth="1.9" />
        <path d={NOTCHES} strokeWidth="1.3" />
      </g>
    </svg>
  );
}
/** Heart silhouette, 32×32 box. */
const HEART = "M16 27 C 12.2 23.8, 6 19.5, 6 13.8 C 6 10.4, 8.5 8.3, 11.3 8.3 C 13.3 8.3, 15 9.4, 16 11 C 17 9.4, 18.7 8.3, 20.7 8.3 C 23.5 8.3, 26 10.4, 26 13.8 C 26 19.5, 19.8 23.8, 16 27 Z";
/** From the right edge along the far arm's lower seam to the thumb base, up the thumb, round its tip and back down its lower edge. */
const THUMB_AND_SEAM = "M24.6 11.5 L17.6 16.4 L14.0 12.95 C 12.85 11.85, 11.05 13.7, 12.2 14.8 L15.8 18.3";
/** Three gaps between the near hand's four fingers, fanning toward the lower right. */
const FINGERS = "M17.4 16.5 L19.1 22.0 M19.2 15.26 L21.4 19.1 M21.0 14.0 L23.1 16.8";
/** The far hand's knuckles, scalloping the lower-left edge, with the notches between them. */
const KNUCKLES: [number, number][] = [[7.6, 17.7], [9.45, 19.9], [11.3, 22.1], [13.1, 24.3]];
const NOTCHES = "M7.58 19.57 L9.73 17.78 M9.48 21.77 L11.63 19.98 M11.28 23.97 L13.43 22.18 M13.08 26.07 L15.23 24.28";
export function Brand({ subtitle = "Your guide to what you qualify for", to = "/" }: { subtitle?: string; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Foster Guide home">
      <Mark className="size-7 lg:size-[30px]" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-bold tracking-[-0.015em] text-ink lg:text-[19px]">Foster Guide</span>
        <span className="mt-0.5 hidden text-[12px] text-ink-faint sm:block">{subtitle}</span>
      </span>
    </Link>
  );
}

function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-rule bg-ground">
      <div className="container-wide flex h-14 items-center justify-between gap-3 lg:h-16">
        <Brand />

        <nav aria-label="Main" className="hidden h-full items-center gap-7 lg:flex">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex h-full items-center border-b-2 pt-0.5 text-[15px] font-medium transition-colors",
                  isActive ? "border-brand text-ink" : "border-transparent text-ink-soft hover:text-ink",
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 lg:gap-3">
          <Link to="/partners" className="hidden text-[13px] text-ink-faint hover:text-ink xl:inline-flex">About &amp; partners</Link>
          <CrisisButton />
          <QuickExit />
        </div>
      </div>
    </header>
  );
}

function TabBarItem({ path, label, icon: Icon, active }: { path: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      to={path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-semibold transition-colors",
        active ? "text-brand" : "text-ink-faint",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
      {label}
    </Link>
  );
}

/**
 * Footer: crisis numbers as plain text on a dark band, then the quiet links.
 * No network request, no button — if everything else fails, this renders.
 */
function SiteFooter() {
  return (
    <footer className="mt-16 lg:mt-20">
      <div className="bg-brand-deep text-on-deep">
        <div className="container-wide flex flex-col gap-4 py-8">
          <p className="text-eyebrow text-sand">If you&rsquo;re in danger or thinking about hurting yourself</p>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <CrisisLine href="tel:988" number="988" label="Call or text, 24/7" />
            <CrisisLine href="sms:741741&body=HOME" number="HOME to 741741" label="Crisis Text Line" />
            <CrisisLine href="tel:18007862929" number="1-800-786-2929" label="National Runaway Safeline" />
            <CrisisLine href="tel:911" number="911" label="Immediate danger" />
          </div>
          <p className="text-[13px] text-on-deep-soft">Free, confidential, no name needed.</p>
        </div>
      </div>
      <div className="container-wide flex flex-col gap-3 py-5 text-[14px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          No account. Nothing you type is tied to your name.{" "}
          <Link to="/privacy" className="text-brand hover:underline">How your information is handled</Link>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link to="/add-resource" className="text-brand hover:underline">Tell us about a program we&rsquo;re missing</Link>
          <Link to="/partners" className="text-brand hover:underline">About &amp; partners</Link>
          {(import.meta.env.DEV || import.meta.env.VITE_PREVIEW) && <AccentToggle />}
        </div>
      </div>
    </footer>
  );
}

/** Preview-only: try the two accent palettes (U1). */
function AccentToggle() {
  const [accent, setAccent] = useState<string>(currentAccent);
  const choose = (next: string) => { applyAccent(next); setAccent(next); };
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
      Accent
      {["teal", "blue"].map(option => (
        <button key={option} type="button" aria-pressed={accent === option} onClick={() => choose(option)} className={cn("rounded px-1.5 py-0.5 capitalize", accent === option ? "bg-brand-soft font-semibold text-ink" : "hover:text-ink")}>
          {option}
        </button>
      ))}
    </span>
  );
}

function CrisisLine({ href, number, label }: { href: string; number: string; label: string }) {
  return (
    <a href={href} className="flex flex-col gap-0.5 hover:underline">
      <span className="font-display text-[26px] font-bold leading-none">{number}</span>
      <span className="text-[14px] text-on-deep-soft">{label}</span>
    </a>
  );
}
