import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bus, Check, GraduationCap, HeartHandshake, Home as HomeIcon, Landmark, MessageCircle, Scale, Search, Send, Stethoscope, Utensils, Briefcase } from "lucide-react";
import { AboutYouCard } from "@/components/home/AboutYouCard";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useAboutYou } from "@/hooks/useAboutYou";
import { useMaya } from "@/contexts/MayaContext";
import { fetchResources, fetchRoadmap, fetchRoadmaps } from "@/lib/api";

const KINDS = [
  { label: "Housing", category: "Housing", icon: HomeIcon },
  { label: "Money", category: "Financial Support", icon: Landmark },
  { label: "School", category: "Education", icon: GraduationCap },
  { label: "Work", category: "Employment", icon: Briefcase },
  { label: "Health", category: "Healthcare", icon: Stethoscope },
  { label: "Talk to someone", category: "Mental Health", icon: MessageCircle },
  { label: "Food", category: "Food Assistance", icon: Utensils },
  { label: "Legal", category: "Legal Support", icon: Scale },
  { label: "Getting around", category: "Transportation", icon: Bus },
  { label: "Mentoring", category: "Life Skills and Mentoring", icon: HeartHandshake },
];

/**
 * Deadlines that close around 21 in California's Extended Foster Care. General
 * guidance, not a personal calendar: the app never knows a birthday.
 */
const DEADLINES = [
  { title: "Extended Foster Care re-certification", detail: "Keeps the monthly payment coming. One form to your worker, every six months.", when: "Before each re-cert date", category: "Financial Support" },
  { title: "THP-Plus housing application", detail: "An apartment plus a support team, up to 36 months. Apply before you age out.", when: "Before 21 (some counties 24)", category: "Housing" },
  { title: "Chafee Grant — money for college or training", detail: "Up to $5,000 a year. FAFSA plus a verification letter; your college's foster youth liaison files both with you.", when: "FAFSA opens Oct 1", category: "Education" },
];

export function HomePage() {
  const navigate = useNavigate();
  const { openMaya } = useMaya();
  const { about } = useAboutYou();
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState("");

  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  const activeId = roadmaps[0]?.id;
  const { data: roadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });
  const nextTask = roadmap?.tasks.find(task => task.status !== "completed" && task.status !== "blocked");
  const doneCount = roadmap?.tasks.filter(task => task.status === "completed").length ?? 0;

  const county = about?.county && about.county !== "elsewhere" ? about.county : undefined;
  const { data: nearby } = useQuery({
    queryKey: ["home-housing", county],
    queryFn: () => fetchResources({ category: "Housing", county, limit: 3 }),
    retry: 1,
  });

  const showDeadlines = !about || about.age === "under18" || about.age === "18-20" || about.age === "unsaid";
  const deadlineHeading = about?.age === "18-20" || about?.age === "under18" ? "Before you turn 21, three things close." : "Turning 21 soon? Three things close before then.";

  return (
    <div>
      {import.meta.env.DEV && <p className="border-b border-rule bg-sand-soft px-5 py-2 text-center text-xs text-ink-soft">Preview · Resource information is still being reviewed for launch.</p>}

      {/* Category bar */}
      <div className="border-b border-rule bg-surface">
        <div className="container-wide flex items-stretch gap-1 overflow-x-auto lg:-ml-3.5">
          {KINDS.map(({ label, category, icon: Icon }) => (
            <Link
              key={category}
              to={`/resources?category=${encodeURIComponent(category)}`}
              className="flex shrink-0 flex-col items-center gap-1.5 px-2.5 py-3 text-[12px] font-medium text-ink-soft hover:text-ink lg:flex-row lg:gap-2 lg:px-3.5 lg:py-4 lg:text-[14px]"
            >
              <Icon className="size-[22px] lg:size-5" strokeWidth={1.8} />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          ))}
          <Link to="/resources" className="flex shrink-0 items-center px-3.5 text-[14px] font-medium text-brand hover:underline">All 16 kinds →</Link>
        </div>
      </div>

      <div className="container-wide grid gap-12 pt-8 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pt-14">
        {/* Left column */}
        <div className="flex flex-col gap-12">
          <section>
            <p className="text-eyebrow text-brand">Free · no account · Alameda and Contra Costa</p>
            <h1 className="mt-4 text-hero text-ink lg:max-w-[760px]">Every program for foster youth in the East Bay, in plain words.</h1>
            <p className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-ink-soft lg:text-[18px]">
              Housing, money for school, food, health, legal help, a job. Search it, save it, or turn it into a plan — you don&rsquo;t have to tell us who you are.
            </p>
            <form
              role="search"
              onSubmit={event => { event.preventDefault(); navigate(search.trim() ? `/resources?q=${encodeURIComponent(search.trim())}` : "/resources"); }}
              className="mt-6 flex max-w-[640px] items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink"
            >
              <Search className="size-5 shrink-0 text-ink-faint" aria-hidden />
              <label htmlFor="home-search" className="sr-only">What do you need help with?</label>
              <input
                id="home-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Try “a place to stay tonight” or “bus pass”"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-ink-body outline-none placeholder:text-ink-stamp lg:h-14"
              />
              <button className="flex h-11 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep" aria-label="Find support">
                <span className="hidden sm:inline">Find</span><ArrowRight className="size-4 sm:hidden" />
              </button>
            </form>
          </section>

          {showDeadlines && (
            <section aria-labelledby="deadlines-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="deadlines-heading" className="font-display text-[24px] font-bold text-ink lg:text-[26px]">{deadlineHeading}</h2>
                <Link to="/resources?q=extended%20foster%20care" className="text-[14px] text-brand hover:underline">Why 21 matters →</Link>
              </div>
              <p className="mt-2 max-w-[620px] text-[15px] text-ink-soft">
                Extended Foster Care ends at 21 in California. These are the deadlines most people miss.{!about && " Tell us your age below and we'll show yours."}
              </p>
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {DEADLINES.map(item => (
                  <li key={item.title} className="row-hover grid gap-1 py-4 sm:grid-cols-[1fr_230px] sm:gap-6">
                    <div>
                      <Link to={`/resources?category=${encodeURIComponent(item.category)}`} className="text-[17px] font-semibold text-ink hover:underline">{item.title}</Link>
                      <p className="mt-0.5 text-[14px] text-ink-soft">{item.detail}</p>
                    </div>
                    <p className="text-stamp text-crisis sm:pt-1 sm:text-right">{item.when}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="nearby-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="nearby-heading" className="font-display text-[24px] font-bold text-ink lg:text-[26px]">Housing{county ? `, ${county} County` : " near you"}</h2>
              <Link to={`/resources?category=Housing${county ? `&county=${encodeURIComponent(county)}` : ""}`} className="text-[14px] text-brand hover:underline">
                All {nearby?.total ?? ""} housing listings →
              </Link>
            </div>
            {!county && <p className="mt-2 text-[14px] text-ink-faint">Pick a county in “About you” to see listings for where you are.</p>}
            <div className="mt-2 divide-y divide-rule border-t border-rule">
              {nearby?.items.map(resource => <ResourceRow key={resource.id} resource={resource} dense />)}
              {!nearby && <p className="py-6 text-[14px] text-ink-faint">Loading listings…</p>}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8">
          <AboutYouCard />

          {roadmap ? (
            <section className="flex flex-col gap-4 rounded-md border border-rule bg-surface p-6 shadow-[0_18px_44px_rgba(20,20,19,0.08),0_3px_10px_rgba(20,20,19,0.04)]">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[24px] font-bold text-ink">My plan</h2>
                <span className="text-eyebrow text-ink-faint">{doneCount} of {roadmap.tasks.length} done</span>
              </div>
              <div className="flex gap-1">
                {roadmap.tasks.map(task => <span key={task.id} className={`h-1 flex-1 rounded-sm ${task.status === "completed" ? "bg-brand" : "bg-rule"}`} />)}
              </div>
              {nextTask ? (
                <div className="-mx-6 bg-sand-soft px-6 py-3">
                  <p className="text-eyebrow text-crisis">Next</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink">{nextTask.taskText}</p>
                </div>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-green"><Check className="size-4" /> Everything on the list is done.</p>
              )}
              <Link to="/roadmap" className="inline-flex h-12 items-center justify-center rounded-md bg-brand text-[15px] font-semibold text-white hover:bg-brand-deep">Open my plan</Link>
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-md border border-rule p-6">
              <h2 className="font-display text-[22px] font-bold text-ink">Start a plan</h2>
              <p className="text-[15px] leading-relaxed text-ink-soft">Six quick questions, one at a time. You get five concrete steps with real programs behind them. Skip anything.</p>
              <Link to="/roadmap" className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface">
                Build my plan <ArrowRight className="size-4" />
              </Link>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-md border border-rule bg-surface p-6">
            <h2 className="font-display text-[22px] font-bold text-ink">Not sure what you qualify for?</h2>
            <form
              onSubmit={event => { event.preventDefault(); openMaya(ask.trim() || undefined); }}
              className="flex items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink"
            >
              <label htmlFor="home-ask" className="sr-only">Ask Maya about your situation</label>
              <input
                id="home-ask"
                value={ask}
                onChange={event => setAsk(event.target.value)}
                placeholder="I'm 19, my case closed last year, and I'm staying with a friend…"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-[15px] text-ink-body outline-none placeholder:text-ink-stamp"
              />
              <button className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-deep" aria-label="Ask Maya"><Send className="size-4" /></button>
            </form>
            <p className="text-[13px] leading-relaxed text-ink-faint">Maya answers from the checked listings only and shows you where each fact came from. AI — not a caseworker.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
