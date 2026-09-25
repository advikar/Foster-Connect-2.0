import { useCallback, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Award, Check, GraduationCap, Home as HomeIcon, Landmark, Plus, Search, Send, Stethoscope, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { AboutYouCard } from "@/components/home/AboutYouCard";
import { useAboutYou } from "@/hooks/useAboutYou";
import { useNova } from "@/contexts/NovaContext";
import { addTask, fetchRoadmap, fetchRoadmaps, type RoadmapTask } from "@/lib/api";

const KINDS = [
  { label: "Housing", category: "Housing", icon: HomeIcon },
  { label: "Money & benefits", category: "Financial Support", icon: Landmark },
  { label: "School & training", category: "Education", icon: GraduationCap },
  { label: "Scholarships", category: "Scholarships", icon: Award },
  { label: "Jobs & work", category: "Employment", icon: Briefcase },
  { label: "Health & mental health", category: "Healthcare,Mental Health", icon: Stethoscope },
];

/**
 * A deadline the page can show, dismiss ("Already did this") or turn into a
 * plan step. `to` is always a search for the thing itself, never a category
 * (R6): "ILP" must land on ILP listings, not on Mentoring in general.
 */
interface Deadline {
  id: string;
  title: string;
  detail: string;
  when: string;
  to: string;
  step: string;
  timeframe: RoadmapTask["timeframe"];
  category: string;
  source?: string;
}

// Source review: 2026-09-20. These are options, not eligibility decisions.
const EFC_SOURCE = "https://www.cdss.ca.gov/inforesources/foster-care/extended-foster-care-ab-12";
const THP_PLUS: Deadline = { id: "thp-plus", title: "THP-Plus housing", detail: "Housing and support for eligible former foster youth. Ask the county about age requirements, openings and how to apply.", when: "Check local requirements", to: "/resources?q=THP", step: "Ask the county about THP-Plus eligibility, openings and application steps", timeframe: "30 Days", category: "Housing", source: "https://www.cdss.ca.gov/inforesources/foster-care/transitional-housing-programs" };
const CHAFEE: Deadline = { id: "chafee", title: "Chafee Grant for college or training", detail: "Financial aid for eligible students with foster care experience. Apply through the Chafee application and FAFSA or California Dream Act Application.", when: "Check this year's requirements", to: "/resources?q=Chafee", step: "Check Chafee Grant requirements and ask the financial aid office which applications I need", timeframe: "3-6 Months", category: "Education", source: "https://csac.ca.gov/foster-youth" };
const EFC: Deadline = { id: "efc", title: "Extended Foster Care", detail: "Eligible young adults can receive support until age 21. A county worker can explain participation requirements and options for staying in or returning to care.", when: "Before age 21", to: "/resources?q=extended%20foster%20care", step: "Ask the county about my Extended Foster Care options and any next steps", timeframe: "This Week", category: "Housing", source: EFC_SOURCE };
const DEADLINES_18_20: Deadline[] = [EFC, THP_PLUS, CHAFEE];
const DEADLINES_UNDER_18: Deadline[] = [{ ...EFC, id: "ab12", title: "Planning for support after 18", detail: "If you are in care, you can talk with your worker about Extended Foster Care and what you would like support with after 18.", when: "Plan ahead", step: "Talk with my worker about support options after I turn 18" },
  { id: "ilp", title: "Independent Living Program (ILP)", detail: "Ask your worker or county ILP team which services are available and whether you can take part.", when: "Check local requirements", to: "/resources?q=ILP", step: "Ask the county ILP team about eligibility and available support", timeframe: "This Week", category: "Life Skills and Mentoring" },
  { id: "documents", title: "Support getting your documents", detail: "If you need an ID, birth certificate or Social Security card, ask your worker about help getting them.", when: "When you need it", to: "/resources?q=documents", step: "Ask my worker for help getting the documents I need", timeframe: "30 Days", category: "General" },
];

/** Which deadlines a person has dismissed or added to a plan, on this device only. */
const DONE_KEY = "fc-deadlines-done";
type DoneMap = Record<string, "did" | "added">;
function useDeadlineState() {
  const [done, setDone] = useState<DoneMap>(() => {
    try { return JSON.parse(window.localStorage.getItem(DONE_KEY) || "{}") as DoneMap; } catch { return {}; }
  });
  const mark = useCallback((id: string, how: "did" | "added" | null) => {
    setDone(previous => {
      const next = { ...previous };
      if (how) next[id] = how; else delete next[id];
      try { window.localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);
  return { done, mark };
}

export function HomePage() {
  usePageMeta("", "Support for current and former foster youth in Alameda and Contra Costa counties: housing, money, school, work, health care, and someone to talk to.", "/");
  const navigate = useNavigate();
  const { openNova } = useNova();
  const { about } = useAboutYou();
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState("");

  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  const activeId = roadmaps[0]?.id;
  const { data: roadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });
  const openTasks = roadmap?.tasks.filter(task => task.status !== "completed") ?? [];
  const nextTask = openTasks.find(task => task.status !== "blocked");
  const doneCount = roadmap?.tasks.filter(task => task.status === "completed").length ?? 0;

  const county = about?.county && about.county !== "elsewhere" ? about.county : undefined;

  const under18 = about?.age === "under18";
  const showDeadlines = Boolean(about && ["under18", "18-20", "21-24"].includes(about.age));
  const deadlines = under18 ? DEADLINES_UNDER_18 : about?.age === "18-20" ? DEADLINES_18_20 : about?.age === "25plus" ? [CHAFEE] : [THP_PLUS, CHAFEE];
  const deadlineHeading = under18 ? "Looking ahead to 18" : "Support options to explore";
  const deadlineIntro = "Your age is a starting point, not a guarantee of eligibility. Each program has its own requirements.";

  return (
    <div>
      {(import.meta.env.DEV || import.meta.env.VITE_PREVIEW) && <p className="border-b border-rule bg-sand-soft px-5 py-2 text-center text-xs text-ink-soft">Preview · Resource information is still being reviewed for launch.</p>}

      <div className="container-wide grid gap-12 pt-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-12 lg:pt-12">
        {/* Left column */}
        <div className="flex flex-col gap-12">
          <section>
            <p className="text-eyebrow text-brand">Foster Guide · Alameda & Contra Costa</p>
            <h1 className="mt-4 text-hero text-ink lg:max-w-[760px]">Find support. Take your next step.</h1>
            <p className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-ink-soft lg:text-[18px]">
              Search housing, scholarships, job training, health care, and everyday support for young people in the East Bay. Made for current and former foster youth, and many of these programs are open to anyone who needs them.
            </p>
            <form
              role="search"
              onSubmit={event => {
                event.preventDefault();
                const next = new URLSearchParams();
                if (search.trim()) next.set("q", search.trim());
                if (about?.age && about.age !== "unsaid") next.set("age", about.age);
                if (county) next.set("county", county);
                navigate(next.toString() ? `/resources?${next}` : "/resources");
              }}
              className="mt-6 flex max-w-[640px] items-center gap-2 rounded-xl border border-brand bg-surface pl-4 pr-1.5 focus-within:border-ink"
            >
              <Search className="size-5 shrink-0 text-ink-faint" aria-hidden />
              <label htmlFor="home-search" className="sr-only">What do you need help with?</label>
              <input
                id="home-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search housing, scholarships, bus passes…"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-ink-body outline-none placeholder:text-ink-stamp lg:h-14"
              />
              <button className="flex h-11 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep" aria-label="Search">
                <span className="hidden sm:inline">Search</span><ArrowRight className="size-4 sm:hidden" />
              </button>
            </form>
            <div className="mt-3 max-w-[640px]"><AboutYouCard /></div>
            <nav aria-label="Browse support categories" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {KINDS.map(({ label, category, icon: Icon }) => (
                <Link key={category} to={`/resources?category=${encodeURIComponent(category)}`} className="group flex min-h-16 items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft">
                  <Icon className="size-5 shrink-0 text-brand" strokeWidth={1.7} aria-hidden />{label}
                </Link>
              ))}
            </nav>
            <Link to="/resources" className="mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:underline">Browse all support <ArrowRight className="size-4" /></Link>
          </section>

          {roadmap ? (
            <UpNext tasks={openTasks} total={roadmap.tasks.length} deadlines={showDeadlines ? deadlines : []} roadmapId={roadmap.id} />
          ) : showDeadlines ? (
            <DeadlineList heading={deadlineHeading} intro={deadlineIntro} whyTo="/resources" whyLabel="See related listings →" deadlines={deadlines} roadmapId={null} />
          ) : null}

        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8">
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
                <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-green"><Check className="size-4" /> {openTasks.length === 0 ? "All steps are marked complete." : "Your remaining steps are marked as blocked. Open your plan to review them."}</p>
              )}
              <Link to="/roadmap" className="inline-flex h-12 items-center justify-center rounded-md bg-brand text-[15px] font-semibold text-white hover:bg-brand-deep">Open my plan</Link>
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-md border border-rule p-6">
              <h2 className="font-display text-[22px] font-bold text-ink">Start a plan</h2>
              <p className="text-[15px] leading-relaxed text-ink-soft">Choose what you want to work on and build a plan you can edit. Most questions are optional.</p>
              <Link to="/roadmap" className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface">
                Build my plan <ArrowRight className="size-4" />
              </Link>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-md border border-rule bg-surface p-6">
            <h2 className="font-display text-[22px] font-bold text-ink">Questions about support?</h2>
            <form
              onSubmit={event => { event.preventDefault(); openNova(ask.trim() || undefined); }}
              className="flex items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink"
            >
              <label htmlFor="home-ask" className="sr-only">Ask Nova about your situation</label>
              <input
                id="home-ask"
                value={ask}
                onChange={event => setAsk(event.target.value)}
                placeholder="What support is available for college?"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-[15px] text-ink-body outline-none placeholder:text-ink-stamp"
              />
              <button className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-deep" aria-label="Ask Nova"><Send className="size-4" /></button>
            </form>
            <p className="text-[13px] leading-relaxed text-ink-faint">Nova is an AI assistant that uses the resource directory. Answers can contain mistakes; confirm eligibility and current details with the provider.</p>
          </section>
          <section className="border-t border-rule pt-6">
            <h2 className="text-[18px] font-semibold text-ink">Working alongside young people?</h2>
            <p className="mt-2 text-[15px] text-ink-soft">Community partners can contribute resources and suggest updates to the directory.</p>
            <Link to="/partners" className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-brand hover:underline">Community partners <ArrowRight className="size-4" /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The "Before you turn…" list, with "Already did this" and, once a plan exists, "Add to my plan" (R7). */
function DeadlineList({ heading, intro, whyTo, whyLabel, deadlines, roadmapId, compact = false }: {
  heading: string; intro?: string; whyTo?: string; whyLabel?: string; deadlines: Deadline[]; roadmapId: number | null; compact?: boolean;
}) {
  const { done, mark } = useDeadlineState();
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (item: Deadline) => addTask(roadmapId!, { taskText: item.step, timeframe: item.timeframe, whyItMatters: `${item.title}: ${item.when}.`, taskCategory: item.category }),
    onSuccess: (_task, item) => {
      mark(item.id, "added");
      void queryClient.invalidateQueries({ queryKey: ["roadmap", roadmapId] });
      toast.success("Added to your plan.");
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not add that to your plan"),
  });
  const open = deadlines.filter(item => !done[item.id]);
  const hidden = deadlines.length - open.length;
  if (deadlines.length === 0) return null;

  return (
    <section aria-labelledby="deadlines-heading" className={compact ? "border-t border-rule pt-6" : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deadlines-heading" className={compact ? "font-display text-[19px] font-bold text-ink" : "font-display text-[24px] font-bold text-ink lg:text-[26px]"}>{heading}</h2>
        {whyTo && <Link to={whyTo} className="text-[14px] text-brand hover:underline">{whyLabel}</Link>}
      </div>
      {intro && <p className="mt-2 max-w-[620px] text-[15px] text-ink-soft">{intro}</p>}
      {open.length === 0 ? (
        <p className="mt-3 text-[15px] text-ink-soft">
          All items in this section are hidden or added to your plan.{" "}
          <button type="button" onClick={() => deadlines.forEach(item => mark(item.id, null))} className="text-brand hover:underline">Show them again</button>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {open.map(item => (
            <li key={item.id} className="row-hover grid gap-2 py-4 sm:grid-cols-[1fr_230px] sm:gap-6">
              <div>
                <Link to={item.to} className="text-[17px] font-semibold text-ink hover:underline">{item.title}</Link>
                <p className="mt-0.5 text-[14px] text-ink-soft">{item.detail}</p>
                {item.source && <a href={item.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-8 items-center text-[13px] text-brand underline">Official program information (opens a new tab)</a>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {roadmapId !== null && (
                    <button type="button" disabled={add.isPending} onClick={() => add.mutate(item)} className="inline-flex min-h-8 items-center gap-1 font-semibold text-brand hover:underline disabled:opacity-50"><Plus className="size-3.5" /> Add to my plan</button>
                  )}
                  <button type="button" onClick={() => mark(item.id, "did")} className="inline-flex min-h-8 items-center gap-1 text-ink-soft hover:text-ink hover:underline"><Check className="size-3.5" /> Already did this</button>
                </div>
              </div>
              <p className="text-stamp text-crisis sm:pt-1 sm:text-right">{item.when}</p>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && hidden > 0 && (
        <p className="mt-2 text-[13px] text-ink-faint">{hidden} hidden as done or on your plan. <button type="button" onClick={() => deadlines.forEach(item => mark(item.id, null))} className="hover:underline">Show all</button></p>
      )}
    </section>
  );
}

/** Once a plan exists, the left column leads with it: the next open steps, then any deadline not on the plan yet (R7). */
function UpNext({ tasks, total, deadlines, roadmapId }: { tasks: RoadmapTask[]; total: number; deadlines: Deadline[]; roadmapId: number }) {
  const ordered = [...tasks].sort((a, b) => TIMEFRAME_ORDER.indexOf(a.timeframe) - TIMEFRAME_ORDER.indexOf(b.timeframe));
  const shown = ordered.slice(0, 3);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="upnext-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="upnext-heading" className="font-display text-[24px] font-bold text-ink lg:text-[26px]">Up next on your plan</h2>
          <Link to="/roadmap" className="text-[14px] text-brand hover:underline">Open my plan →</Link>
        </div>
        <p className="mt-2 text-[15px] text-ink-soft">{tasks.length === 0 ? `All ${total} steps are done.` : `${tasks.length} of ${total} steps still open. Ordered by timeframe.`}</p>
        {shown.length > 0 && (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {shown.map(task => (
              <li key={task.id} className="row-hover grid gap-1 py-4 sm:grid-cols-[1fr_150px] sm:gap-6">
                <div>
                  <Link to="/roadmap" className="text-[17px] font-semibold text-ink hover:underline">{task.taskText}</Link>
                  {task.whyItMatters && <p className="mt-0.5 text-[14px] text-ink-soft">{task.whyItMatters}</p>}
                </div>
                <p className={`text-stamp sm:pt-1 sm:text-right ${task.timeframe === "This Week" ? "text-crisis" : "text-ink-faint"}`}>{task.status === "blocked" ? "Marked as blocked" : task.timeframe}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <DeadlineList heading="Other support options" deadlines={deadlines} roadmapId={roadmapId} compact />
    </div>
  );
}
const TIMEFRAME_ORDER: RoadmapTask["timeframe"][] = ["This Week", "30 Days", "3-6 Months", "6-12 Months"];
