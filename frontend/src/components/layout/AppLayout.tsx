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
 * The mark (U2): two hands clasped into a heart, on a brand-coloured circle.
 * Drawn from the user's reference; the circle follows the accent token.
 */
export function Mark({ className = "size-[30px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="16" fill="var(--brand)" />
      <path d={HEART} fill="#FFFFFF" />
      <path d={CLASP} fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** Heart silhouette, 32×32 box. */
const HEART = "M16 26.5 C 12.6 23.6, 7.2 19.6, 7.2 14.4 C 7.2 11.2, 9.5 9.2, 12.1 9.2 C 13.8 9.2, 15.2 10.1, 16 11.5 C 16.8 10.1, 18.2 9.2, 19.9 9.2 C 22.5 9.2, 24.8 11.2, 24.8 14.4 C 24.8 19.6, 19.4 23.6, 16 26.5 Z";
/** The clasp: the right hand's cuff and edge crossing from the top right, the left hand's fingers curling under at the bottom left. */
const CLASP = "M22.6 11.6 L14.4 19.8 M20.2 10.2 L16.4 14 M10.6 16.6 L13.4 19.4 M11.6 18.9 L14.3 21.6 M12.9 21 L15.4 23.5 M14.4 22.9 L16.4 24.9 M16.2 21.2 L19.8 17.6 M17.9 22.8 L21.2 19.5";
export function Brand({ subtitle = "Alameda & Contra Costa County", to = "/" }: { subtitle?: string; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Foster Connect home">
      <Mark className="size-7 lg:size-[30px]" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-bold tracking-[-0.015em] text-ink lg:text-[19px]">Foster Connect</span>
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
