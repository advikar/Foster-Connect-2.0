import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bus, Check, GraduationCap, HeartHandshake, Home as HomeIcon, Landmark, MessageCircle, Plus, Scale, Search, Send, Stethoscope, Utensils, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { AboutYouCard } from "@/components/home/AboutYouCard";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useAboutYou } from "@/hooks/useAboutYou";
import { useNova } from "@/contexts/NovaContext";
import { addTask, fetchResources, fetchRoadmap, fetchRoadmaps, type RoadmapTask } from "@/lib/api";

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
}

const THP_PLUS: Deadline = { id: "thp-plus", title: "THP-Plus housing application", detail: "An apartment plus a support team, up to 36 months. You don't have to be in care to apply.", when: "Before 21 (some counties 24)", to: "/resources?q=THP", step: "Apply for THP-Plus housing — ask my worker or the county ILP office which providers have openings", timeframe: "30 Days", category: "Housing" };
const CHAFEE: Deadline = { id: "chafee", title: "Chafee Grant — money for college or training", detail: "Up to $5,000 a year. FAFSA plus a verification letter; your college's foster youth liaison files both with you.", when: "FAFSA opens Oct 1", to: "/resources?q=Chafee", step: "File the FAFSA and ask the college's foster youth liaison to file the Chafee Grant with me", timeframe: "3-6 Months", category: "Education" };

/** 18–20 and in Extended Foster Care: keep it going, then the two doors that close at 21. */
const DEADLINES_IN_CARE: Deadline[] = [
  { id: "recert", title: "Extended Foster Care re-certification", detail: "Keeps the monthly payment coming. One form to your worker, every six months.", when: "Before each re-cert date", to: "/resources?q=extended%20foster%20care", step: "Ask my worker for my next Extended Foster Care re-certification form and turn it in", timeframe: "30 Days", category: "Financial Support" },
  THP_PLUS,
  CHAFEE,
];
/** 18–20 and no longer in care: re-entry is the door most people don't know is open. */
const DEADLINES_FORMER: Deadline[] = [
  { id: "reenter", title: "Re-enter Extended Foster Care", detail: "If you left care after 18, you can come back in until your 21st birthday — housing help and a monthly payment. Ask the county, not a judge.", when: "Before 21", to: "/resources?q=extended%20foster%20care", step: "Call the county's Extended Foster Care line and ask how to re-enter before I turn 21", timeframe: "This Week", category: "Housing" },
  THP_PLUS,
  CHAFEE,
];
/** 18–20, care status unknown: don't assume either way. */
const DEADLINES_18_20: Deadline[] = [
  { id: "efc", title: "Extended Foster Care — stay in, or come back", detail: "In care: a re-certification form to your worker every six months keeps the payment coming. Left care: you can re-enter until 21.", when: "Before 21", to: "/resources?q=extended%20foster%20care", step: "Ask my worker (or the county) where I stand with Extended Foster Care and what the next form is", timeframe: "30 Days", category: "Financial Support" },
  THP_PLUS,
  CHAFEE,
];
/** For someone under 18 the deadline that matters is 18, not 21. */
const DEADLINES_UNDER_18: Deadline[] = [
  { id: "ab12", title: "Extended Foster Care (AB 12) — decide before 18", detail: "You can stay in care with housing and a monthly payment until 21. Tell your worker you want it before your 18th birthday.", when: "Before 18", to: "/resources?q=extended%20foster%20care", step: "Tell my worker I want to stay in Extended Foster Care after I turn 18", timeframe: "30 Days", category: "Housing" },
  { id: "ilp", title: "Independent Living Program (ILP)", detail: "Classes, a stipend and a mentor, from age 16. Ask your worker to enroll you if nobody has.", when: "From 16", to: "/resources?q=ILP", step: "Ask my worker to enroll me in ILP", timeframe: "This Week", category: "Life Skills and Mentoring" },
  { id: "documents", title: "Your documents, in your hands", detail: "State ID, birth certificate and Social Security card. Your worker has to help you get them before you leave care.", when: "Before 18", to: "/resources?q=documents", step: "Ask my worker for my state ID, birth certificate and Social Security card", timeframe: "30 Days", category: "General" },
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
  // Not a fixed "Housing" list: the three most recently checked listings of
  // any kind for where they are. Crisis lines live in the crisis bar instead.
  const { data: nearby } = useQuery({
    queryKey: ["home-recent", county],
    queryFn: async () => {
      const page = await fetchResources({ county, sort: "checked", limit: 8 });
      return { ...page, items: page.items.filter(resource => !resource.isCrisis).slice(0, 3) };
    },
    retry: 1,
  });

  const under18 = about?.age === "under18";
  const showDeadlines = !about || under18 || about.age === "18-20" || about.age === "unsaid";
  const deadlines = under18 ? DEADLINES_UNDER_18 : about?.age === "18-20" && about.care === "in_care" ? DEADLINES_IN_CARE : about?.age === "18-20" && about.care === "former" ? DEADLINES_FORMER : DEADLINES_18_20;
  const deadlineHeading = under18
    ? "Before you turn 18, three things to line up."
    : about?.age === "18-20" ? "Before you turn 21, three things close." : "Turning 21 soon? Three things close before then.";
  const deadlineIntro = under18
    ? "Turning 18 in care comes with choices nobody explains well. These three keep your options open."
    : about?.age === "18-20" && about.care === "in_care"
      ? "Extended Foster Care ends at 21 in California. These are the deadlines most people miss."
      : about?.age === "18-20" && about.care === "former"
        ? "You left care, but three doors are still open until 21 — including going back in."
        : `Whether you're in Extended Foster Care or left it, these three have deadlines around 21.${!about ? " Tell us your age below and we'll show yours." : ""}`;

  return (
    <div>
      {(import.meta.env.DEV || import.meta.env.VITE_PREVIEW) && <p className="border-b border-rule bg-sand-soft px-5 py-2 text-center text-xs text-ink-soft">Preview · Resource information is still being reviewed for launch.</p>}

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
            <p className="text-eyebrow text-brand">Your guide to what you qualify for · free · no account</p>
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

          {roadmap ? (
            <UpNext tasks={openTasks} total={roadmap.tasks.length} deadlines={showDeadlines ? deadlines : []} roadmapId={roadmap.id} />
          ) : showDeadlines ? (
            <DeadlineList heading={deadlineHeading} intro={deadlineIntro} whyTo="/resources?q=extended%20foster%20care" whyLabel={under18 ? "Why 18 matters →" : "Why 21 matters →"} deadlines={deadlines} roadmapId={null} />
          ) : null}

          <section aria-labelledby="nearby-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="nearby-heading" className="font-display text-[24px] font-bold text-ink lg:text-[26px]">Checked recently{county ? `, ${county} County` : ""}</h2>
              <Link to={`/resources?sort=checked${county ? `&county=${encodeURIComponent(county)}` : ""}`} className="text-[14px] text-brand hover:underline">
                All {nearby?.total ?? ""} listings →
              </Link>
            </div>
            <p className="mt-2 text-[14px] text-ink-faint">{county ? "The latest listings a person has checked for where you are." : "Pick a county in “About you” to see listings for where you are."}</p>
            <div className="mt-2 divide-y divide-rule border-t border-rule">
              {nearby?.items.map(resource => <ResourceRow key={resource.id} resource={resource} dense />)}
              {!nearby && <p className="py-6 text-[14px] text-ink-faint">Loading listings…</p>}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8">
          {/* On phones the plan and Ask cards come first; tuning the page can wait. */}
          <div className="order-last lg:order-first"><AboutYouCard /></div>

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
              onSubmit={event => { event.preventDefault(); openNova(ask.trim() || undefined); }}
              className="flex items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink"
            >
              <label htmlFor="home-ask" className="sr-only">Ask Nova about your situation</label>
              <input
                id="home-ask"
                value={ask}
                onChange={event => setAsk(event.target.value)}
                placeholder="I'm 19, my case closed last year, and I'm staying with a friend…"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-[15px] text-ink-body outline-none placeholder:text-ink-stamp"
              />
              <button className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-deep" aria-label="Ask Nova"><Send className="size-4" /></button>
            </form>
            <p className="text-[13px] leading-relaxed text-ink-faint">Nova answers from the checked listings only and shows you where each fact came from. AI — not a caseworker.</p>
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
          You&rsquo;ve handled these.{" "}
          <button type="button" onClick={() => deadlines.forEach(item => mark(item.id, null))} className="text-brand hover:underline">Show them again</button>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {open.map(item => (
            <li key={item.id} className="row-hover grid gap-2 py-4 sm:grid-cols-[1fr_230px] sm:gap-6">
              <div>
                <Link to={item.to} className="text-[17px] font-semibold text-ink hover:underline">{item.title}</Link>
                <p className="mt-0.5 text-[14px] text-ink-soft">{item.detail}</p>
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
        <p className="mt-2 text-[15px] text-ink-soft">{tasks.length === 0 ? `All ${total} steps are done.` : `${tasks.length} of ${total} steps still open. Small ones first.`}</p>
        {shown.length > 0 && (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {shown.map(task => (
              <li key={task.id} className="row-hover grid gap-1 py-4 sm:grid-cols-[1fr_150px] sm:gap-6">
                <div>
                  <Link to="/roadmap" className="text-[17px] font-semibold text-ink hover:underline">{task.taskText}</Link>
                  {task.whyItMatters && <p className="mt-0.5 text-[14px] text-ink-soft">{task.whyItMatters}</p>}
                </div>
                <p className={`text-stamp sm:pt-1 sm:text-right ${task.timeframe === "This Week" ? "text-crisis" : "text-ink-faint"}`}>{task.status === "blocked" ? "Stuck — ask Nova" : task.timeframe}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <DeadlineList heading="Deadlines not on your plan yet" deadlines={deadlines} roadmapId={roadmapId} compact />
    </div>
  );
}
const TIMEFRAME_ORDER: RoadmapTask["timeframe"][] = ["This Week", "30 Days", "3-6 Months", "6-12 Months"];
