import { useEffect, useRef, useState } from "react";
import { applyAccent, currentAccent } from "@/lib/accent";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Bookmark, Home, ListChecks, MessageCircle, Search } from "lucide-react";
import { NovaProvider } from "@/contexts/NovaContext";
import { CrisisButton } from "@/components/safety/CrisisBar";
import { ListingDeepLink } from "@/components/resources/ListingDeepLink";
import { cn } from "@/lib/utils";
import { CONTACT_EMAIL } from "@/lib/contact";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/resources", label: "Search", icon: Search },
  { path: "/ask", label: "Ask", icon: MessageCircle },
  { path: "/roadmap", label: "My plan", icon: ListChecks },
  { path: "/saved", label: "Saved", icon: Bookmark },
];

/**
 * Youth shell (September 2026 redesign).
 *
 *   Phone   — 56px header (brand, Need help now), five-tab bar.
 *   Desktop — 64px header with underline navigation, utilities on the right.
 *
 * Need help now is always visible and never behind a menu (Quick exit was
 * removed 2026-09-21 at the founder's request).
 * The crisis numbers are also printed as plain text in the footer of every
 * page, from compiled-in constants, so they survive every failure mode.
 */
export function AppLayout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    // A new page starts at the top (audit A15); Back/Forward keeps the browser's own position.
    if (navigationType !== "POP") window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: navigationType === "POP" });
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
        <ListingDeepLink />

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

/** Each hand has four finger contours and a thumb forming the central clasp. */
export function Mark({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 108" className={cn("shrink-0 text-brand", className)} aria-hidden focusable="false" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 57C-4 39 5 7 28 5C37 4 44 8 50 12C73-7 96 9 96 30C96 41 91 50 85 56" />
      <path d="M50 12L35 27C24 37 34 46 43 38L55 27L65 22M55 27C65 38 71 40 82 35" />
      <path d="M60 33L84 56C96 67 84 76 76 68L61 53M76 68C82 77 72 85 65 78L52 65M65 78C71 86 61 94 54 87L44 77M54 87C65 94 56 104 48 97L40 89" />
      <g fill="var(--color-ground, #f7f6f2)">
        <rect x="16" y="46" width="13" height="24" rx="6.5" transform="rotate(43 22.5 58)" />
        <rect x="24" y="55" width="13" height="24" rx="6.5" transform="rotate(43 30.5 67)" />
        <rect x="32" y="64" width="13" height="24" rx="6.5" transform="rotate(43 38.5 76)" />
        <rect x="40" y="73" width="13" height="22" rx="6.5" transform="rotate(43 46.5 84)" />
      </g>
    </svg>
  );
}
export function Brand({ subtitle = "Your guide for the next step", to = "/" }: { subtitle?: string; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Foster Guide home">
      <Mark className="size-8 lg:size-10" />
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

        <nav aria-label="Main" className="hidden h-full items-center gap-5 lg:flex">
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
          <Link to="/partners" className="hidden whitespace-nowrap text-[13px] text-ink-faint hover:text-ink md:inline-flex">Community partners</Link>
          <CrisisButton />
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
            <CrisisLine href="sms:741741?&body=HOME" number="HOME to 741741" label="Crisis Text Line" />
            <CrisisLine href="tel:18007862929" number="1-800-786-2929" label="National Runaway Safeline" />
            <CrisisLine href="tel:911" number="911" label="Immediate danger" />
          </div>
          <p className="text-[13px] text-on-deep-soft">For immediate support, contact a crisis service. Each service has its own privacy practices.</p>
        </div>
      </div>
      <div className="container-wide border-b border-rule py-5 text-[13px] leading-relaxed text-ink-faint">
        <p>
          Foster Guide is a directory, not legal, medical or financial advice. The people behind it are not attorneys or caseworkers. Listings are checked against public information and can change, so confirm details with the program before you rely on them. For a legal question, talk to a lawyer or a legal-aid program listed here.
        </p>
      </div>
      <div className="container-wide flex flex-col gap-3 py-5 text-[14px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          Browse without an account.{" "}
          <Link to="/privacy" className="text-brand hover:underline">How your information is handled</Link>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link to="/add-resource" className="text-brand hover:underline">Tell us about a program we&rsquo;re missing</Link>
          <Link to="/partners" className="text-brand hover:underline">Community partners</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand hover:underline">Contact us <span className="text-ink-faint">(questions about the site, not emergencies)</span></a>
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
