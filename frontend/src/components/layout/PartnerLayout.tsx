import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ChartNoAxesCombined, FilePlus2, LayoutDashboard, ListChecks, LogOut, MessageSquareText, ShieldCheck } from "lucide-react";
import { PartnerProvider, usePartner } from "@/contexts/PartnerContext";
import { Mark } from "./AppLayout";
import { cn } from "@/lib/utils";

const links = [
  { to: "/partners", label: "Overview", icon: LayoutDashboard },
  { to: "/partners/submissions", label: "My submissions", icon: ListChecks },
  { to: "/partners/add-resource", label: "Add a resource", icon: FilePlus2 },
  { to: "/partners/coverage", label: "Directory coverage", icon: ChartNoAxesCombined },
  { to: "/partners/guide", label: "Partner guide", icon: MessageSquareText },
];
export function PartnerLayout() { return <PartnerProvider><Shell /></PartnerProvider>; }
function Shell() {
  const { partner, signOut } = usePartner();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus(); }, [pathname]);
  const navigation = partner?.role === "reviewer" ? [...links, { to: "/partners/review", label: "Review queue", icon: ShieldCheck }] : links;
  return <div className="min-h-screen bg-ground">
    <a href="#partner-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
    <header className="border-b border-rule bg-surface px-5 lg:px-8"><div className="mx-auto flex min-h-20 max-w-[1440px] flex-wrap items-center justify-between gap-3 py-3"><Link to="/partners" className="flex items-center gap-3"><Mark /><span><span className="block font-display text-lg font-bold text-ink">Foster Connect</span><span className="text-xs font-semibold text-brand">COMMUNITY PARTNERS</span></span></Link><div className="flex items-center gap-4">{!partner && <Link to="/partners/sign-in" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">Sign in</Link>}<Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="size-4" />Youth experience</Link></div></div></header>
    <div className="mx-auto grid max-w-[1504px] grid-cols-1 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[248px_1fr]">
      <aside className="min-w-0 border-b border-rule bg-surface p-4 lg:border-b-0 lg:border-r lg:p-6">
        <p className="mb-4 hidden text-eyebrow text-ink-soft lg:block">Your workspace</p>
        <div className="lg:hidden"><label htmlFor="partner-navigation" className="mb-2 block text-xs font-semibold text-ink-soft">Workspace section</label><select id="partner-navigation" value={navigation.some(link => link.to === pathname) ? pathname : ""} onChange={event => navigate(event.target.value)} className="min-h-12 w-full rounded-xl border border-rule bg-surface px-3 text-base text-ink"><option value="" disabled>Choose a section</option>{navigation.map(link => <option key={link.to} value={link.to}>{link.label}</option>)}</select></div>
        <nav aria-label="Partner navigation" className="hidden gap-2 pb-2 lg:flex lg:flex-col">{navigation.map(({to, label, icon: Icon}) => <NavLink key={to} to={to} end={to === "/partners"} className={({isActive}) => cn("flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-medium", isActive ? "bg-brand-deep text-white" : "text-ink-soft hover:bg-brand-soft")}><Icon className="size-[18px]" />{label}</NavLink>)}</nav>
        <div className="mt-6 hidden border-t border-rule pt-6 lg:block"><Building2 className="size-5 text-brand" /><p className="mt-3 text-sm font-semibold text-ink">{partner?.organisation || "Better information. Better connections."}</p><p className="mt-2 text-xs leading-relaxed text-ink-soft">{partner ? `${partner.name} · ${partner.role}` : "A shared place to keep local support useful and easier to find."}</p></div>
        {partner && <button onClick={() => { void signOut(); }} className="mt-3 inline-flex min-h-11 items-center gap-2 px-3 text-sm text-ink-soft"><LogOut className="size-4" />Sign out</button>}
      </aside>
      <main ref={main} tabIndex={-1} id="partner-main" className="min-w-0 px-5 py-8 outline-none lg:px-10 lg:py-10"><Outlet /></main>
    </div>
  </div>;
}
