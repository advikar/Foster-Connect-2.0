import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus, ShieldCheck } from "lucide-react";
import { usePartner } from "@/contexts/PartnerContext";
import { askPartnerGuide, fetchMySubmissions, fetchPartnerAnalytics, type Submission } from "@/lib/api";
import { Coverage, Queue, SignIn } from "./InsightsPage";
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

function Access({ children, reviewer = false }: { children: ReactNode; reviewer?: boolean }) {
  const { partner, checking, error, refresh, signedIn } = usePartner();
  if (checking) return <p role="status" className="py-10 text-ink-soft">Checking your sign-in…</p>;
  if (error) return <div role="alert" className="mt-6 rounded-md border border-rule bg-surface p-6"><p>{error}</p><Button className="mt-4 h-11 rounded-md bg-brand text-white" onClick={refresh}>Try again</Button></div>;
  if (!partner) return <div className="mt-8"><SignIn onSignedIn={signedIn} /></div>;
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
      <Heading eyebrow="Overview" title={partner ? `Welcome back, ${firstName}.` : "Help make the next step possible."}>
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
        <Stat label="Awaiting review" value={analytics.isLoading ? null : pending} detail={myPending ? `${myPending} yours` : "Across all partners"} tone={pending > 0 ? "rust" : "ink"} />
        <Stat label="Your published listings" value={mine.isLoading ? null : myPublished} detail={mine.data?.length ? `${mine.data.length} submitted in total` : "Nothing submitted yet"} />
        <Stat label="Flagged by youth" value={analytics.isLoading ? null : reports.length} detail="Reports on live listings" tone={reports.length ? "rust" : "ink"} />
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
            {[["01", "You share the facts and link the official source."], ["02", "A reviewer checks eligibility, cost and how to start."], ["03", "It appears in search and in Maya's answers, with the date it was checked."]].map(([n, t]) => (
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
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["partner-my-submissions"], queryFn: fetchMySubmissions, retry: 1 });
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all");
  if (isLoading) return <p role="status" className="text-ink-soft">Loading your submissions…</p>;
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

export function PartnerReview() {
  const { partner } = usePartner();
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Verification" title="Review queue">
        Check the official source and the required details before a listing becomes visible to young people. Approving puts your name on the audit record.
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

function Guide() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    try { setReply((await askPartnerGuide(message)).reply); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The guide is unavailable right now."); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {["What should I verify before listing a housing program?", "Help me outline a new transportation resource.", "Questions a young person could ask a provider"].map(prompt => (
            <Chip key={prompt} onClick={() => setMessage(prompt)}>{prompt}</Chip>
          ))}
        </div>
        <form onSubmit={event => { event.preventDefault(); void submit(); }} className="flex flex-col gap-2">
          <label htmlFor="partner-question" className="text-[13px] font-semibold text-ink-soft">What are you working on?</label>
          <Textarea id="partner-question" maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} className="min-h-28 rounded-md border-rule bg-surface text-base" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-ink-faint">Use public information only. No names, case details or private records.</span>
            <Button disabled={busy || message.trim().length < 3} className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep">
              {busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Preparing…" : "Ask the guide"}
            </Button>
          </div>
        </form>
        {error && <p role="alert" className="rounded-md bg-crisis-soft px-4 py-3 text-[14px] text-crisis">{error}</p>}
        {reply && (
          <section aria-live="polite" className="rounded-md border border-rule bg-surface p-6">
            <p className="text-eyebrow text-brand">Draft · review before use</p>
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-body">{reply}</p>
          </section>
        )}
      </div>
      <aside className="self-start rounded-md bg-sand-soft p-5 text-[14px] text-ink-soft">
        <p className="font-semibold text-ink">How this differs from Maya</p>
        <p className="mt-1.5">Maya talks to young people and only answers from published listings. This guide is for staff, handles each question on its own, and remembers nothing between questions.</p>
      </aside>
    </div>
  );
}

export function PartnerSignIn() {
  const { partner } = usePartner();
  return (
    <div className="flex flex-col gap-8">
      <Heading eyebrow="Partner account" title={partner ? "You're signed in." : "Same directory, different tools."}>
        For caseworkers, agencies and community partners. Accounts are created by Foster Connect — there&rsquo;s no self sign-up.
      </Heading>
      <Access>
        <Link to="/partners" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:underline">Go to overview <ArrowRight className="size-4" /></Link>
      </Access>
    </div>
  );
}
