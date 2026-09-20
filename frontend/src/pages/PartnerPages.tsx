import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChartNoAxesCombined, FilePlus2, Loader2, Plus, ShieldCheck } from "lucide-react";
import { usePartner } from "@/contexts/PartnerContext";
import { askPartnerGuide, fetchMySubmissions, fetchPartnerAnalytics, GUIDE_CONVERSATION_KEY, type ChatMessageInput, type Submission } from "@/lib/api";
import { Coverage, Gaps, Queue, SignIn } from "./InsightsPage";
import { AddResourcePage } from "./AddResourcePage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/primitives/Chip";
import { Tag } from "@/components/resources/ResourceRow";
import { cn } from "@/lib/utils";

export function Heading({ eyebrow, title, children, action }: { eyebrow: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-eyebrow text-brand">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[30px] font-bold text-ink lg:text-[36px]">{title}</h1>
        {children && <p className="mt-2 max-w-[64ch] text-[16px] leading-relaxed text-ink-soft">{children}</p>}
      </div>
      {action}
    </header>
  );
}

/** Workspace gate (P1): anything inside needs a signed-in partner; otherwise go to the one sign-in page and come back after. */
function Access({ children, reviewer = false }: { children: ReactNode; reviewer?: boolean }) {
  const { partner, checking, error, refresh } = usePartner();
  const location = useLocation();
  if (checking) return <p role="status" className="py-10 text-ink-soft">Checking your sign-in…</p>;
  if (error) return <div role="alert" className="mt-6 rounded-md border border-rule bg-surface p-6"><p>{error}</p><Button className="mt-4 h-11 rounded-md bg-brand text-white" onClick={refresh}>Try again</Button></div>;
  if (!partner) return <Navigate to={`/partners/sign-in?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (reviewer && partner.role !== "reviewer") {
    return (
      <div className="mt-8 max-w-[560px] rounded-md border border-rule bg-surface p-6">
        <ShieldCheck className="size-6 text-brand" />
        <h2 className="mt-3 font-display text-[22px] font-bold text-ink">Reviewer access required</h2>
        <p className="mt-2 text-[15px] text-ink-soft">You can submit resources and track their status. Publishing is reserved for designated reviewers.</p>
        <Link to="/partners/submissions" className="mt-4 inline-flex min-h-10 items-center text-[15px] font-semibold text-brand hover:underline">View my submissions →</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export const STATUS_LABEL: Record<Submission["status"], string> = { approved: "Published", pending: "Awaiting review", rejected: "Not approved" };
export function StatusTag({ status }: { status: Submission["status"] }) {
  const tone = status === "approved" ? "green" : status === "pending" ? "sand" : "rust";
  return <Tag tone={tone}>{STATUS_LABEL[status]}</Tag>;
}

export function PartnerOverview() {
  const { partner } = usePartner();
  const firstName = partner?.name.split(" ")[0];
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Overview" title={partner ? `Welcome back, ${firstName}.` : "Signing you in…"}>
        Share local services, follow them through review, and see where the directory is thin. A useful connection starts with accurate information.
      </Heading>
      <Access>
        <OverviewBody reviewer={partner?.role === "reviewer"} />
      </Access>
    </div>
  );
}

function OverviewBody({ reviewer }: { reviewer?: boolean }) {
  const mine = useQuery({ queryKey: ["partner-my-submissions"], queryFn: fetchMySubmissions, retry: 1 });
  const analytics = useQuery({ queryKey: ["partner-analytics"], queryFn: fetchPartnerAnalytics, retry: 1 });
  const pending = analytics.data?.pipeline.pending ?? 0;
  const myPublished = mine.data?.filter(item => item.status === "approved").length ?? 0;
  const myPending = mine.data?.filter(item => item.status === "pending").length ?? 0;
  const reports = analytics.data?.reports ?? [];
  const attention = [
    ...(mine.data ?? []).filter(item => item.status === "pending").slice(0, 3).map(item => ({ key: `s${item.id}`, title: item.title, detail: `Submitted by you · ${ago(item.created_at)}`, status: "pending" as const, to: "/partners/submissions" })),
    ...reports.slice(0, 3).map(report => ({ key: `r${report.id}`, title: report.title, detail: `Youth report: “${report.reason.slice(0, 80)}${report.reason.length > 80 ? "…" : ""}” · ${ago(report.created_at)}`, status: "report" as const, to: "/partners/coverage#reports" })),
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Awaiting review" value={analytics.isPending || analytics.isError ? null : pending} detail={myPending ? `${myPending} yours` : "Across all partners"} tone={pending > 0 ? "rust" : "ink"} />
        <Stat label="Your published listings" value={mine.isPending || mine.isError ? null : myPublished} detail={mine.data?.length ? `${mine.data.length} submitted in total` : "Nothing submitted yet"} />
        <Stat label="Flagged by youth" value={analytics.isPending || analytics.isError ? null : reports.length} detail="Reports on live listings" tone={reports.length ? "rust" : "ink"} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[22px] font-bold text-ink">Needs attention</h2>
            {reviewer && <Link to="/partners/review" className="text-[14px] text-brand hover:underline">Open review queue →</Link>}
          </div>
          {attention.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-rule p-6 text-[15px] text-ink-soft">Nothing waiting on you. Submissions you make and reports from young people show up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-t border-rule">
              {attention.map(item => (
                <li key={item.key} className="row-hover -mx-2 flex items-center justify-between gap-4 rounded px-2 py-3.5">
                  <Link to={item.to} className="min-w-0"><p className="truncate font-semibold text-ink">{item.title}</p><p className="text-[13px] text-ink-faint">{item.detail}</p></Link>
                  {item.status === "pending" ? <StatusTag status="pending" /> : <Tag tone="rust">Needs re-check</Tag>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-3 self-start rounded-md bg-sand-soft p-6">
          <h2 className="font-display text-[20px] font-bold text-ink">How a listing gets to a young person</h2>
          <ol className="flex flex-col gap-2.5 text-[14px] text-ink-soft">
            {[["01", "You share the facts and link the official source."], ["02", "A reviewer checks eligibility, cost and how to start."], ["03", "It appears in search and in Nova's answers, with the date it was checked."]].map(([n, t]) => (
              <li key={n} className="grid grid-cols-[24px_1fr] gap-2"><span className="text-eyebrow pt-0.5 text-brand">{n}</span><span>{t}</span></li>
            ))}
          </ol>
          <Link to="/partners/add-resource" className="mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface"><Plus className="size-4" /> Add a resource</Link>
        </aside>
      </div>
    </>
  );
}

export function Stat({ label, value, detail, tone = "ink" }: { label: string; value: number | null; detail?: string; tone?: "ink" | "rust" | "green" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-rule bg-surface p-5">
      <p className="text-eyebrow text-ink-faint">{label}</p>
      <p className={cn("tabular font-display text-[38px] font-bold leading-none", tone === "rust" ? "text-crisis" : tone === "green" ? "text-green" : "text-ink")}>{value === null ? "…" : value}</p>
      {detail && <p className="mt-1 text-[13px] text-ink-faint">{detail}</p>}
    </div>
  );
}

export function ago(iso: string) {
  const then = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PartnerSubmissions() {
  return (
    <div className="flex flex-col gap-8">
      <Heading
        eyebrow="My contributions"
        title="My submissions"
        action={<Link to="/partners/add-resource" className="inline-flex h-12 items-center gap-2 rounded-md bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep"><Plus className="size-4" /> Add a resource</Link>}
      >
        Follow the resources you&rsquo;ve shared from review to publication. Older anonymous submissions aren&rsquo;t linked to your account.
      </Heading>
      <Access><Submissions /></Access>
    </div>
  );
}

function Submissions() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["partner-my-submissions"], queryFn: fetchMySubmissions, retry: 1 });
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all");
  if (isPending) return <p role="status" className="text-ink-soft">Loading your submissions…</p>;
  if (isError) return <div role="alert" className="rounded-md border border-rule bg-surface p-6"><p>We couldn&rsquo;t load your submissions.</p><Button onClick={() => { void refetch(); }} className="mt-4 h-11 rounded-md bg-brand text-white">Try again</Button></div>;
  if (!data?.length) {
    return (
      <div className="rounded-md border border-dashed border-rule p-8">
        <h2 className="font-display text-[22px] font-bold text-ink">Your first contribution starts here</h2>
        <p className="mt-2 max-w-[52ch] text-[15px] text-ink-soft">Resources submitted while signed in will appear here with their review status and any reviewer notes.</p>
      </div>
    );
  }
  const counts = { all: data.length, pending: data.filter(s => s.status === "pending").length, approved: data.filter(s => s.status === "approved").length, rejected: data.filter(s => s.status === "rejected").length };
  const shown = filter === "all" ? data : data.filter(item => item.status === filter);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>All {counts.all}</Chip>
        <Chip selected={filter === "pending"} onClick={() => setFilter("pending")}>Awaiting review {counts.pending}</Chip>
        <Chip selected={filter === "approved"} onClick={() => setFilter("approved")}>Published {counts.approved}</Chip>
        <Chip selected={filter === "rejected"} onClick={() => setFilter("rejected")}>Not approved {counts.rejected}</Chip>
      </div>
      <div className="mt-5 hidden grid-cols-[1fr_150px_140px_150px] gap-4 pb-2 text-eyebrow text-ink-faint md:grid"><span>Resource</span><span>County</span><span>Submitted</span><span>Status</span></div>
      <ul className="divide-y divide-rule border-t border-rule">
        {shown.map(item => (
          <li key={item.id} className="flex flex-col gap-2 py-3.5">
            <div className="grid gap-1 md:grid-cols-[1fr_150px_140px_150px] md:items-center md:gap-4">
              <div className="min-w-0"><p className="font-semibold text-ink">{item.title}</p><p className="text-[13px] text-ink-faint">{item.organization} · {item.category}</p></div>
              <span className="text-[14px] text-ink-soft">{item.county}</span>
              <span className="text-stamp">{new Date(item.created_at.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              <span><StatusTag status={item.status} /></span>
            </div>
            {item.moderator_note && (
              <p className={cn("max-w-[72ch] rounded px-3.5 py-2.5 text-[14px] text-ink-soft", item.status === "rejected" ? "bg-crisis-soft" : "bg-sunk")}>
                Reviewer note: {item.moderator_note}
                {item.status === "rejected" && <> <Link to="/partners/add-resource" className="text-brand hover:underline">Submit a corrected version →</Link></>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PartnerAddResource() {
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Share a resource" title="Add a resource">
        Nothing you send goes live on its own. A reviewer checks the source, who qualifies and the contact details before any young person sees it.
      </Heading>
      <Access><AddResourcePage partnerMode /></Access>
    </div>
  );
}

export function PartnerCoverage() {
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Directory intelligence" title="Where the directory is strong, and where it's thin">
        Listing counts show what the directory covers. They do not measure open places, eligibility matches or unmet demand. A low count is a question to investigate, not an answer.
      </Heading>
      <Access><Coverage /></Access>
    </div>
  );
}

export function PartnerGaps() {
  const { partner } = usePartner();
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Fill the gaps" title="A minute here makes a listing usable.">
        Blank fields are where young people get stuck: no number to call, no idea what it costs. Fill in what you know.
      </Heading>
      <Access><Gaps reviewer={partner?.role === "reviewer"} /></Access>
    </div>
  );
}

export function PartnerReview() {
  const { partner } = usePartner();
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Verification" title="Review queue">
        New listings and proposed changes wait here. Check the official source before approving; approving puts your name on the audit record and shows who proposed the change.
      </Heading>
      <Access reviewer>{partner && <Queue reviewer={partner} />}</Access>
    </div>
  );
}

export function PartnerGuide() {
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Staff guide · AI" title="A second set of questions.">
        Get help drafting a service description or a verification checklist. Review every suggestion before using it. This guide can&rsquo;t publish anything and can&rsquo;t see youth plans or chats.
      </Heading>
      <Access><Guide /></Access>
    </div>
  );
}

interface GuideTurn { role: "user" | "assistant"; content: string; error?: boolean }
interface GuideThread { turns: GuideTurn[]; history: ChatMessageInput[]; historyToken?: string }
const EMPTY_THREAD: GuideThread = { turns: [], history: [] };

function loadGuideThread(): GuideThread {
  try {
    const raw = sessionStorage.getItem(GUIDE_CONVERSATION_KEY);
    if (!raw) return EMPTY_THREAD;
    const parsed = JSON.parse(raw) as Partial<GuideThread>;
    return Array.isArray(parsed.turns) ? { turns: parsed.turns, history: parsed.history ?? [], historyToken: parsed.historyToken } : EMPTY_THREAD;
  } catch { return EMPTY_THREAD; }
}

/**
 * The staff guide as a thread. The server signs the history the same way it
 * does for Nova, so follow-ups ("make that shorter", "now the checklist")
 * work. Kept in sessionStorage alongside the sign-in token: it ends with the
 * tab or with sign-out, whichever is first.
 */
function Guide() {
  const [thread, setThread] = useState<GuideThread>(loadGuideThread);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = thread.turns.length > 0;

  useEffect(() => {
    try {
      if (thread.turns.length) sessionStorage.setItem(GUIDE_CONVERSATION_KEY, JSON.stringify(thread));
      else sessionStorage.removeItem(GUIDE_CONVERSATION_KEY);
    } catch { /* private mode */ }
  }, [thread]);
  useEffect(() => { if (started) endRef.current?.scrollIntoView({ block: "nearest" }); }, [thread.turns.length, busy, started]);

  const submit = async (text = message) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    setBusy(true);
    setMessage("");
    setThread(previous => ({ ...previous, turns: [...previous.turns, { role: "user", content: question }] }));
    try {
      const response = await askPartnerGuide(question, thread.history, thread.historyToken);
      setThread(previous => ({ turns: [...previous.turns, { role: "assistant", content: response.reply }], history: response.history, historyToken: response.historyToken }));
    } catch (caught) {
      setThread(previous => ({ ...previous, turns: [...previous.turns, { role: "assistant", error: true, content: caught instanceof Error ? caught.message : "The guide is unavailable right now." }] }));
    } finally {
      setBusy(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  };
  const clear = () => { setThread(EMPTY_THREAD); inputRef.current?.focus(); };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        {started && (
          <ol className="flex flex-col gap-3" aria-live="polite">
            {thread.turns.map((turn, index) => (
              <li key={index} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[92%] whitespace-pre-wrap text-[15px] leading-relaxed",
                  turn.role === "user" ? "rounded-[12px_12px_2px_12px] bg-ink px-4 py-3 text-on-deep" : "rounded-[12px_12px_12px_2px] border border-rule bg-surface px-5 py-4 text-ink-body",
                  turn.error && "border-crisis/40 text-crisis",
                )}>
                  {turn.role === "assistant" && !turn.error && <p className="text-eyebrow mb-2 text-brand">Draft · review before use</p>}
                  {turn.content}
                </div>
              </li>
            ))}
            {busy && <li className="flex w-fit items-center gap-2 rounded-md border border-rule bg-surface px-4 py-2.5 text-sm text-ink-faint"><Loader2 className="size-3.5 animate-spin" /> Preparing…</li>}
            <div ref={endRef} />
          </ol>
        )}
        {!started && (
          <div className="flex flex-wrap gap-2">
            {["What should I verify before listing a housing program?", "Help me outline a new transportation resource.", "Questions a young person could ask a provider"].map(prompt => (
              <Chip key={prompt} onClick={() => void submit(prompt)}>{prompt}</Chip>
            ))}
          </div>
        )}
        <form onSubmit={event => { event.preventDefault(); void submit(); }} className="flex flex-col gap-2">
          <label htmlFor="partner-question" className="text-[13px] font-semibold text-ink-soft">{started ? "Follow up" : "What are you working on?"}</label>
          <Textarea
            id="partner-question"
            ref={inputRef}
            maxLength={2000}
            value={message}
            onChange={event => setMessage(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
            placeholder={started ? "Ask for changes or the next step. Shift+Enter for a new line." : "Describe the service, or paste a draft to tighten."}
            className="min-h-24 rounded-md border-rule bg-surface text-base"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-ink-faint">Use public information only. No names, case details or private records.</span>
            <div className="flex items-center gap-4">
              {started && <button type="button" onClick={clear} className="text-[14px] text-brand hover:underline">Start over</button>}
              <Button disabled={busy || message.trim().length < 3} className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep">
                {busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Preparing…" : started ? "Send" : "Ask the guide"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <aside className="self-start rounded-md bg-sand-soft p-5 text-[14px] text-ink-soft">
        <p className="font-semibold text-ink">How this differs from Nova</p>
        <p className="mt-1.5">Nova talks to young people and only answers from published listings. This guide is for staff. It remembers this thread while you are signed in on this tab, and forgets it when you sign out or start over.</p>
      </aside>
    </div>
  );
}

/**
 * The one sign-in page (P1, P3). Partner users sign in here; reviewers use the
 * same form via the small link at the bottom (?as=reviewer), which changes the
 * copy and lands them on the review queue.
 */
export function PartnerSignIn() {
  const { partner, checking, signedIn } = usePartner();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const asReviewer = params.get("as") === "reviewer";
  const next = params.get("next");
  const destination = (identity: { role: string }) => {
    if (next && next.startsWith("/partners/")) return next;
    return asReviewer && identity.role === "reviewer" ? "/partners/review" : "/partners/overview";
  };
  if (!checking && partner) return <Navigate to={destination(partner)} replace />;
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 py-6 lg:py-12">
      <div>
        <p className="text-eyebrow text-brand">{asReviewer ? "Reviewer sign-in" : "Partner sign-in"}</p>
        <h1 className="mt-2 font-display text-[30px] font-bold text-ink">{asReviewer ? "Approve what young people will see." : "Same directory, different tools."}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {asReviewer
            ? "Reviewers are the one or two people Foster Guide has vetted to approve listings and changes. Sign in with your reviewer account."
            : "For caseworkers, agencies and community partners: add services, fill in gaps and use the staff guide."}
        </p>
      </div>
      <SignIn onSignedIn={identity => { signedIn(identity); navigate(destination(identity), { replace: true }); }} reviewer={asReviewer} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-faint">
        <Link to="/partners" className="hover:text-ink">← About Foster Guide for partners</Link>
        {asReviewer
          ? <Link to="/partners/sign-in" className="hover:text-ink">Not a reviewer? Partner sign-in</Link>
          : <Link to="/partners/sign-in?as=reviewer" className="hover:text-ink">Reviewer? Sign in here</Link>}
      </div>
    </div>
  );
}

/** Public landing (P2): what Foster Guide is, who partners are, what they can do, and the way in. */
export function PartnerLanding() {
  const { partner } = usePartner();
  return (
    <div className="flex flex-col gap-12 py-4 lg:py-10">
      <section className="max-w-[720px]">
        <p className="text-eyebrow text-brand">About Foster Guide · for partners</p>
        <h1 className="mt-3 font-display text-[34px] font-bold leading-tight text-ink lg:text-[44px]">Every program for foster youth in the East Bay, checked by people who know them.</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
          Foster Guide is a free directory and AI guide for current and former foster youth in Alameda and Contra Costa counties. Young people search it, save listings, and turn them into a plan without giving their name. Everything they see was checked by a person first.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={partner ? "/partners/overview" : "/partners/sign-in"} className="inline-flex h-12 items-center gap-2 rounded-md bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep">
            {partner ? "Open the workspace" : "Partner sign-in"} <ArrowRight className="size-4" />
          </Link>
          <Link to="/add-resource" className="inline-flex h-12 items-center rounded-md border border-ink px-5 text-[15px] font-semibold text-ink hover:bg-surface">Suggest a listing without an account</Link>
        </div>
      </section>

      <section>
        <h2 className="text-eyebrow text-ink-faint">Who partners are</h2>
        <p className="mt-2 max-w-[64ch] text-[16px] leading-relaxed text-ink-soft">
          Caseworkers, ILP and THP staff, school liaisons, clinic and shelter teams, and community organizations that serve transition-age youth. Partners create their own account; reviewer accounts are set up by Foster Guide.
        </p>
      </section>

      <section>
        <h2 className="text-eyebrow text-ink-faint">What you can do once signed in</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: FilePlus2, title: "Add a resource", body: "Submit a service or a guide. A reviewer checks it before young people see it." },
            { icon: ChartNoAxesCombined, title: "See where the directory is thin", body: "Coverage by kind and county, and which listings are missing a phone, cost or hours. Fill a gap and it goes to review." },
            { icon: BookOpen, title: "Use the staff guide", body: "An AI assistant for drafting descriptions and verification checklists. It never sees youth plans or chats." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-md border border-rule bg-surface p-5">
              <Icon className="size-5 text-brand" />
              <h3 className="mt-3 text-[17px] font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-[720px] rounded-md bg-sand-soft p-6">
        <h2 className="font-display text-[22px] font-bold text-ink">Reviewers</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          One or two people vetted by Foster Guide approve new listings and proposed changes, and can see who proposed them. Youth plans, chats and saved lists are never visible to anyone.
        </p>
        <Link to="/partners/sign-in?as=reviewer" className="mt-3 inline-flex min-h-10 items-center text-[14px] font-semibold text-brand hover:underline">Reviewer sign-in →</Link>
      </section>
    </div>
  );
}
