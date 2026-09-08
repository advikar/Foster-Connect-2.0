import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bookmark, Compass, Home, ListChecks } from "lucide-react";
import { MayaOverlay } from "@/components/chat/MayaOverlay";
import { MayaLauncher } from "@/components/chat/MayaLauncher";
import { MayaProvider } from "@/contexts/MayaContext";
import { CrisisButton } from "@/components/safety/CrisisBar";
import { QuickExit } from "@/components/safety/QuickExit";
import { useSavedResources } from "@/hooks/useSavedResources";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/resources", label: "Find support", icon: Compass },
  { path: "/roadmap", label: "My plan", icon: ListChecks },
  { path: "/saved", label: "Saved", icon: Bookmark },
];

/**
 * AppShell.
 *
 * Two genuinely different layouts rather than one stretched across both:
 *
 *   Phone   — 56px header, bottom tab bar, thumb-reachable, full-bleed content.
 *   Desktop — a 76px top bar with pill navigation and a wide 1240px container,
 *             the way the original prototype was laid out.
 *
 * The earlier version put a 240px sidebar next to a phone-width column, which
 * is why desktop looked plain: it was a mobile layout with furniture bolted on,
 * not a layout designed for the space.
 */
export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to main on route change so screen reader users don't lose
  // their place. Skipped on first paint, where focus belongs at the top.
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <MayaProvider>
      <div className="flex min-h-screen flex-col bg-ground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <TopBar />

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 pb-40 pt-14 outline-none lg:pb-0 lg:pt-[76px]"
        >
          <Outlet />
        </main>

        <SiteFooter />

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Primary"
          className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-surface/95 backdrop-blur lg:hidden"
        >
          {tabs.map(tab => <TabBarItem key={tab.path} {...tab} active={location.pathname === tab.path} />)}
        </nav>

        <MayaLauncher />
        <MayaOverlay />
        <QuickExit />
      </div>
    </MayaProvider>
  );
}

/** The mark is a roof line — shelter, and the shape of a next step. */
export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-brand-deep", className)}>
      <svg viewBox="0 0 64 64" className="size-[62%]" aria-hidden focusable="false">
        <path d="M14 36 L32 18 L50 36" fill="none" stroke="#d9a441" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 35 v13 h24 v-13" fill="none" stroke="#f4f2ec" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function TopBar() {
  const { savedCount } = useSavedResources();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-rule bg-surface/90 backdrop-blur">
      <div className="container-wide flex h-14 items-center justify-between gap-4 lg:h-[76px]">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark className="size-8 lg:size-10" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-bold tracking-[-0.03em] text-ink lg:text-[19px]">
              Foster Connect
            </span>
            <span className="mt-1 hidden text-[11px] font-medium text-ink-faint lg:block">
              Alameda &amp; Contra Costa County
            </span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {tabs.slice(0, 3).map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2.5 text-[14.5px] font-semibold transition-colors",
                  isActive ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-sunk hover:text-ink",
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/partners" className="hidden min-h-11 items-center px-2 text-xs font-semibold text-brand xl:inline-flex">For partners</Link>
          <span className="hidden lg:inline-flex">
            <QuickExit variant="inline" />
          </span>
          <Link
            to="/saved"
            aria-label={savedCount ? `Saved, ${savedCount} items` : "Saved"}
            className="relative hidden size-10 items-center justify-center rounded-full border border-rule bg-surface text-ink-soft transition-colors hover:border-brand hover:text-brand lg:flex"
          >
            <Bookmark className="size-[18px]" />
            {savedCount > 0 && (
              <span className="tabular absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-sand px-1 text-[10px] font-bold text-brand-deep">
                {savedCount}
              </span>
            )}
          </Link>
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
        "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold tracking-[0.01em] transition-colors",
        active ? "text-brand" : "text-ink-faint",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
      {label}
    </Link>
  );
}

const footerLinks = [
  {
    heading: "Find support",
    links: [
      { label: "Browse everything", to: "/resources" },
      { label: "Housing", to: "/resources?category=Housing" },
      { label: "Money & benefits", to: "/resources?category=Financial%20Support" },
      { label: "Someone to talk to", to: "/resources?category=Mental%20Health" },
    ],
  },
  {
    heading: "Your space",
    links: [
      { label: "Your plan", to: "/roadmap" },
      { label: "Saved", to: "/saved" },
      { label: "Your data", to: "/privacy" },
    ],
  },
  {
    heading: "Contribute",
    links: [
      { label: "Share a resource", to: "/add-resource" },
      { label: "For partners", to: "/partners" },
    ],
  },
];

/**
 * Footer.
 *
 * Also the one place crisis numbers appear as plain, always-visible text on
 * every page — no button, no sheet, no network request.
 */
function SiteFooter() {
  return (
    <footer className="mt-12 bg-brand-deep pb-28 pt-14 text-on-deep lg:mt-20 lg:pb-14">
      <div className="container-wide">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark className="size-9" />
              <span className="font-display text-[18px] font-bold tracking-[-0.03em] text-on-deep">
                Foster Connect
              </span>
            </div>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-on-deep-soft">
              Local support for current and former foster youth. Find a resource,
              take a next step, and come back whenever you need.
            </p>
          </div>

          {footerLinks.map(column => (
            <div key={column.heading}>
              <h2 className="text-eyebrow text-sand">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(link => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-[14px] text-on-deep-soft transition-colors hover:text-on-deep">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-[13.5px] font-semibold text-on-deep">
            If you need someone right now
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-on-deep-soft">
            Call or text{" "}
            <a href="tel:988" className="font-semibold text-sand underline underline-offset-2">988</a>
            {" "}&middot; Text HOME to{" "}
            <a href="sms:741741" className="font-semibold text-sand underline underline-offset-2">741741</a>
            {" "}&middot; Runaway Safeline{" "}
            <a href="tel:18007862929" className="font-semibold text-sand underline underline-offset-2">1-800-786-2929</a>
            {" "}&middot; In immediate danger, call 911.
          </p>
        </div>
      </div>
    </footer>
  );
}
