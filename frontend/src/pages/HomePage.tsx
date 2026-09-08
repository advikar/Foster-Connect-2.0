import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bookmark, BriefcaseBusiness, Bus, Check, ChevronRight, Compass, GraduationCap, Home as HomeIcon, Landmark, ListChecks, MapPin, MessageCircle, Salad, Search, Stethoscope } from "lucide-react";
import { fetchRoadmap, fetchRoadmaps } from "@/lib/api";
import { useMaya } from "@/contexts/MayaContext";

const needs = [
  { label: "A place to stay", category: "Housing", icon: HomeIcon, hint: "Housing & shelter", color: "bg-[#e7eef5] text-[#365c7f]" },
  { label: "Money & benefits", category: "Financial Support", icon: Landmark, hint: "Bills, cash aid & essentials", color: "bg-[#f6ecd7] text-[#856020]" },
  { label: "School & training", category: "Education", icon: GraduationCap, hint: "College, trades & tuition", color: "bg-[#ece8f5] text-[#69538d]" },
  { label: "A job", category: "Employment", icon: BriefcaseBusiness, hint: "Work & career support", color: "bg-[#f5e7df] text-[#956044]" },
  { label: "Health care", category: "Healthcare", icon: Stethoscope, hint: "Clinics, dental & coverage", color: "bg-[#e4eeee] text-[#396e73]" },
  { label: "Food", category: "Food Assistance", icon: Salad, hint: "Groceries & meals", color: "bg-[#eff0dc] text-[#6b7134]" },
  { label: "Getting around", category: "Transportation", icon: Bus, hint: "Bus passes & rides", color: "bg-[#e7edf5] text-[#496684]" },
  { label: "Someone to talk to", category: "Mental Health", icon: MessageCircle, hint: "Counseling & peer support", color: "bg-[#f3e7ee] text-[#925d7b]" },
];

export function HomePage() {
  const { openMaya } = useMaya();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  const activeId = roadmaps[0]?.id;
  const { data: roadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });
  const nextTask = useMemo(() => roadmap?.tasks.find(task => task.status !== "completed" && task.status !== "blocked"), [roadmap]);

  return (
    <div>
      {import.meta.env.DEV && <p className="border-b border-rule bg-sand-soft px-5 py-2 text-center text-xs text-ink-soft">Preview · Resource information is still being reviewed for launch.</p>}
      <section className="container-wide pt-9 lg:pt-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
          <div className="py-2 lg:py-5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-brand"><MapPin className="size-4" aria-hidden /> Alameda &amp; Contra Costa counties</p>
            <h1 className="mt-5 font-display text-[42px] font-bold leading-[1.06] tracking-[-0.045em] text-ink sm:text-[56px] lg:text-[64px]">A little support.<br /><span className="text-brand">Your next step.</span></h1>
            <p className="mt-5 max-w-[43ch] text-base leading-relaxed text-ink-soft lg:text-lg">Find local help for everyday life, or make a plan for what comes next. Start wherever you are.</p>
            <form role="search" className="mt-7 flex items-center gap-2 rounded-2xl border border-rule bg-surface p-2 shadow-sm" onSubmit={event => { event.preventDefault(); navigate(search.trim() ? `/resources?q=${encodeURIComponent(search.trim())}` : "/resources"); }}>
              <Search className="ml-2 size-5 shrink-0 text-brand" aria-hidden />
              <label htmlFor="home-search" className="sr-only">What do you need help with?</label>
              <input id="home-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Housing, a job, bus passes…" className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand" />
              <button className="flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-deep" aria-label="Find support"><ArrowRight className="size-5 sm:hidden" /><span className="hidden sm:inline">Find support</span></button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-soft"><span className="flex items-center gap-1.5"><Check className="size-4 text-brand" />No account needed to browse</span><Link to="/resources" className="inline-flex min-h-8 items-center gap-1 font-semibold text-brand hover:underline">Browse all support <ArrowRight className="size-3.5" /></Link></div>
          </div>
          <aside className="relative overflow-hidden rounded-[28px] bg-brand-deep p-6 text-on-deep lg:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full border-[35px] border-white/5" />
            <p className="hidden text-eyebrow text-sand lg:block">At your own pace</p>
            <h2 className="relative max-w-[24ch] font-display text-[22px] font-semibold leading-[1.12] tracking-[-0.03em] text-on-deep lg:mt-4 lg:max-w-[16ch] lg:text-[30px]">You don’t have to figure it all out today.</h2>
            <p className="mt-3 hidden text-[15px] leading-relaxed text-on-deep-soft lg:block">Turn one goal into small, practical steps. You decide where to begin.</p>
            <div className="mt-6 hidden rounded-2xl bg-white/[0.07] p-4 lg:block">
              <p className="text-xs font-semibold uppercase tracking-widest text-on-deep-soft">{nextTask ? "Your next step" : "A plan can help you"}</p>
              {nextTask ? <p className="mt-3 text-base leading-relaxed">{nextTask.taskText}</p> : <ul className="mt-3 space-y-3 text-[14px]"><li className="flex items-center gap-3"><Compass className="size-4 text-sand" />Find support that fits your goal</li><li className="flex items-center gap-3"><ListChecks className="size-4 text-sand" />Know what to do first</li><li className="flex items-center gap-3"><Bookmark className="size-4 text-sand" />Keep useful resources together</li></ul>}
            </div>
            <Link to="/roadmap" className="mt-5 flex min-h-12 items-center justify-between rounded-xl bg-sand px-4 text-[15px] font-semibold text-brand-deep hover:bg-sand-soft">{nextTask ? "Continue my plan" : "Build my plan"}<ArrowRight className="size-4" /></Link>
          </aside>
        </div>
      </section>
      <section className="container-wide pt-10 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-eyebrow text-brand">Find your starting point</p><h2 className="mt-2 font-display text-[27px] font-bold tracking-[-0.035em] text-ink lg:text-[32px]">What would help today?</h2></div><p className="text-sm text-ink-soft">One thing at a time is enough.</p></div>
        <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {needs.map(({icon: Icon, ...need}) => <li key={need.category}><Link to={`/resources?category=${encodeURIComponent(need.category)}`} className="group flex h-full flex-col rounded-2xl border border-rule bg-surface p-4 transition-colors hover:border-brand hover:bg-brand-soft/30 lg:p-5"><div className="flex items-center justify-between"><span className={`flex size-11 items-center justify-center rounded-xl ${need.color}`}><Icon className="size-[22px]" strokeWidth={1.7} aria-hidden /></span><ChevronRight className="size-4 text-ink-soft" aria-hidden /></div><span className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-ink lg:text-base">{need.label}</span><span className="mt-1 text-[13px] leading-relaxed text-ink-soft">{need.hint}</span></Link></li>)}
        </ul>
      </section>
      <section className="container-wide pt-8 lg:pt-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex items-start gap-4 rounded-2xl border border-rule bg-[#eaf0ef] p-6"><MessageCircle className="mt-1 size-6 shrink-0 text-brand" /><div><h2 className="font-display text-xl font-semibold text-ink">Not sure where to start?</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">Maya, our AI guide, can help you explore resources and think through a next step.</p><button onClick={() => openMaya()} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline">Ask Maya <ArrowRight className="size-4" /></button></div></div>
          <div className="flex items-start gap-4 rounded-2xl border border-rule bg-surface p-6"><HomeIcon className="mt-1 size-6 shrink-0 text-brand" /><div><h2 className="font-display text-xl font-semibold text-ink">Here to support young people?</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">Help keep local resource information useful. Share a service or visit the partner workspace.</p><Link to="/partners" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline">For community partners <ArrowRight className="size-4" /></Link></div></div>
        </div>
      </section>
    </div>
  );
}
