import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChartNoAxesCombined, FilePlus2, Inbox, LayoutGrid, ListChecks, Mail, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { PartnerProvider, usePartner } from "@/contexts/PartnerContext";
import { Brand } from "./AppLayout";
import { cn } from "@/lib/utils";
import { CONTACT_EMAIL } from "@/lib/contact";
import { trackPageView } from "@/lib/analytics";

const links = [
  { to: "/partners/overview", label: "Overview", icon: LayoutGrid },
  { to: "/partners/submissions", label: "My submissions", icon: Inbox },
  { to: "/partners/add-resource", label: "Add a resource", icon: FilePlus2 },
  { to: "/partners/resources", label: "Search listings", icon: Search },
  { to: "/partners/coverage", label: "Coverage", icon: ChartNoAxesCombined },
  { to: "/partners/gaps", label: "Fill the gaps", icon: ListChecks },
  { to: "/partners/guide", label: "Staff guide", icon: BookOpen },
];

/**
 * Partner shell: a persistent sidebar on desktop, a chip row on phones.
 * Same tokens as the youth side, denser. Youth plans, chats and saved lists
 * are never reachable from here.
 */
export function PartnerLayout() { return <PartnerProvider><Shell /></PartnerProvider>; }

function Shell() {
  const { partner, signOut } = usePartner();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  useEffect(() => { trackPageView(pathname); main.current?.focus(); }, [pathname]);
  const reviewer = partner?.role === "reviewer";
  // The workspace (sidebar, chip row) exists only once signed in (P1). The
  // landing and sign-in pages get a plain header.
  const workspace = Boolean(partner);

  return (
    <div className={cn("min-h-screen bg-ground", workspace && "lg:grid lg:grid-cols-[256px_1fr] lg:grid-rows-[64px_1fr]")}>
      <a href="#partner-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to content</a>

      <header className="flex h-14 items-center justify-between border-b border-rule bg-surface px-5 lg:col-span-2 lg:h-16 lg:px-8">
        <Brand subtitle="For partners" to={workspace ? "/partners/overview" : "/partners"} />
        <div className="flex items-center gap-4 text-[14px]">
          <Link to="/" className="inline-flex items-center gap-1.5 text-ink-faint hover:text-ink"><ArrowLeft className="size-3.5" /> Youth site</Link>
          {partner ? (
            <>
              <span className="hidden items-center gap-2.5 lg:inline-flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-ink"><UserRound className="size-4" /></span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold text-ink">{partner.name}</span>
                  <span className="text-[12px] text-ink-faint">{reviewer ? "Reviewer" : "Contributor"} · {partner.organisation}</span>
                </span>
              </span>
              <button type="button" onClick={() => { void signOut().then(() => navigate("/partners")); }} className="min-h-10 text-ink-faint hover:text-ink">Sign out</button>
            </>
          ) : (
            <Link to="/partners/sign-in" className="inline-flex min-h-10 items-center rounded-md border border-ink px-3.5 text-[14px] font-semibold text-ink hover:bg-sand-soft">Sign in</Link>
          )}
        </div>
      </header>

      {workspace && (
        <>
          {/* Phone navigation: a scrolling chip row */}
          <nav aria-label="Partner navigation" className="flex gap-2 overflow-x-auto border-b border-rule bg-surface px-5 py-3 lg:hidden">
            {[...links, ...(reviewer ? [{ to: "/partners/review", label: "Review queue", icon: ShieldCheck }, { to: "/partners/accounts", label: "Accounts", icon: Users }] : [])].map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn("inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[14px] font-medium", isActive ? "border-brand-soft bg-brand-soft font-semibold text-ink" : "border-rule bg-surface text-ink-soft")}>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop sidebar */}
          <aside className="hidden border-r border-rule bg-surface px-4 py-6 lg:flex lg:flex-col">
            <p className="text-eyebrow px-3 pb-2 text-ink-faint">Workspace</p>
            <nav aria-label="Partner navigation" className="flex flex-col gap-1">
              {links.map(({ to, label, icon: Icon }) => <SideLink key={to} to={to} label={label} icon={Icon} />)}
            </nav>
            {reviewer && (
              <>
                <p className="text-eyebrow px-3 pb-2 pt-6 text-ink-faint">Reviewers</p>
                <SideLink to="/partners/review" label="Review queue" icon={ShieldCheck} />
                <SideLink to="/partners/accounts" label="Accounts" icon={Users} />
              </>
            )}
            <div className="mt-auto px-3 pt-6 text-[12px] leading-relaxed text-ink-faint">
              <p className="inline-flex items-center gap-1.5 font-semibold text-ink-soft"><Mail className="size-3.5" /> Contact</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="mt-0.5 block break-all text-brand hover:underline">{CONTACT_EMAIL}</a>
              <p className="mt-3">Youth plans, chats and saved lists are not shown here.</p>
            </div>
          </aside>
        </>
      )}

      <main ref={main} tabIndex={-1} id="partner-main" className={cn("min-w-0 px-5 py-8 outline-none", workspace ? "lg:max-w-[1088px] lg:px-12 lg:py-10" : "mx-auto w-full max-w-[1088px] lg:px-12 lg:py-10")}>
        <Outlet />
        <div className="mt-12 max-w-[720px] border-t border-rule pt-4 text-[12px] leading-relaxed text-ink-faint">
          <p>Foster Guide is a directory, not legal advice. Nobody on the team is an attorney; listings are checked against public information. Verify details with the program before acting on them.</p>
          <p className="mt-2">Questions, corrections or partnership ideas: <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand hover:underline">{CONTACT_EMAIL}</a></p>
        </div>
      </main>
    </div>
  );
}

function SideLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[15px]", isActive ? "bg-brand-soft font-semibold text-ink" : "font-medium text-ink-soft hover:bg-ground hover:text-ink")}>
      <Icon className="size-[18px]" />
      {label}
    </NavLink>
  );
}
