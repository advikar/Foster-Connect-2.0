import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChartNoAxesCombined, FilePlus2, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { usePartner } from "@/contexts/PartnerContext";
import { askPartnerGuide, fetchMySubmissions } from "@/lib/api";
import { Coverage, Queue, SignIn } from "./InsightsPage";
import { AddResourcePage } from "./AddResourcePage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <header><p className="text-eyebrow text-brand">{eyebrow}</p><h1 className="mt-3 font-display text-[34px] font-bold leading-tight tracking-[-0.035em] text-ink lg:text-[42px]">{title}</h1><p className="mt-3 max-w-[65ch] text-base leading-relaxed text-ink-soft">{children}</p></header>;
}
function Access({ children, reviewer = false }: { children: ReactNode; reviewer?: boolean }) {
  const { partner, checking, error, refresh, signedIn } = usePartner();
  if (checking) return <p role="status" className="py-10 text-ink-soft">Checking your sign-in…</p>;
  if (error) return <div role="alert" className="mt-6 rounded-2xl border border-rule bg-surface p-6"><p>{error}</p><Button className="mt-4" onClick={refresh}>Try again</Button></div>;
  if (!partner) return <div className="mt-8"><SignIn onSignedIn={signedIn} /></div>;
  if (reviewer && partner.role !== "reviewer") return <div className="mt-8 rounded-2xl border border-rule bg-surface p-6"><ShieldCheck className="size-6 text-brand" /><h2 className="mt-3 text-lg font-semibold">Reviewer access required</h2><p className="mt-2 text-sm text-ink-soft">You can submit resources and track their status. Publishing is reserved for designated reviewers.</p><Link to="/partners/submissions" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand">View my submissions</Link></div>;
  return children;
}
export function PartnerOverview() {
  const { partner } = usePartner();
  return <><Heading eyebrow="Community partner workspace" title={partner ? `Welcome, ${partner.name}.` : "Help make the next step possible."}>Share local services, keep track of submissions, and understand what the directory covers. A useful connection starts with accurate information.</Heading>
    <div className="mt-8 grid gap-4 xl:grid-cols-3">{[
      {to:"/partners/add-resource", title:"Share a resource", text:"Add service details and a source for review.", icon:FilePlus2},
      {to:"/partners/coverage", title:"See directory coverage", text:"Find categories and regions to investigate.", icon:ChartNoAxesCombined},
      {to:"/partners/guide", title:"Work through a draft", text:"Get help with descriptions and verification questions.", icon:MessageSquareText},
    ].map(({to,title,text,icon:Icon}) => <Link key={to} to={to} className="group rounded-2xl border border-rule bg-surface p-6 transition-colors hover:border-brand"><Icon className="size-6 text-brand" /><h2 className="mt-5 text-lg font-semibold text-ink">{title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p><ArrowRight className="mt-5 size-4 text-brand" /></Link>)}</div>
    <section className="mt-8 rounded-2xl bg-brand-deep p-6 lg:p-8"><p className="text-eyebrow text-sand">From a listing to a useful connection</p><ol className="mt-5 grid gap-5 text-on-deep lg:grid-cols-3">{[["01", "Share the facts", "Describe the service and link its official source."],["02", "A reviewer checks", "Eligibility, cost, and how to start are checked before publication."],["03", "Youth can find it", "Approved listings appear in resource search."]].map(([n,t,d]) => <li key={n}><span className="text-sm text-sand">{n}</span><h2 className="mt-2 font-semibold text-on-deep">{t}</h2><p className="mt-2 text-sm leading-relaxed text-on-deep-soft">{d}</p></li>)}</ol></section>
    <Access><div className="mt-8 flex flex-wrap gap-4"><Link to="/partners/submissions" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white">My submissions <ArrowRight className="size-4" /></Link>{partner?.role === "reviewer" && <Link to="/partners/review" className="inline-flex min-h-12 items-center rounded-xl border border-rule px-5 font-semibold text-brand">Open review queue</Link>}</div></Access>
  </>;
}
export function PartnerSubmissions() {
  return <><Heading eyebrow="My contributions" title="My submissions">Follow the resources you’ve shared from review to publication.</Heading><Access><Submissions /></Access></>;
}
function Submissions() {
  const { partner } = usePartner();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["partner-own-submissions", partner?.email], queryFn: fetchMySubmissions });
  if (isLoading) return <p role="status" className="mt-8">Loading your submissions…</p>;
  if (isError) return <div role="alert" className="mt-8"><p>We couldn’t load your submissions.</p><Button onClick={() => { void refetch(); }} className="mt-4">Try again</Button></div>;
  return <><Link to="/partners/add-resource" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white"><FilePlus2 className="size-4" />Add a resource</Link>{!data?.length ? <div className="mt-6 rounded-2xl border border-dashed border-rule bg-surface p-8"><h2 className="text-lg font-semibold">Your first contribution starts here</h2><p className="mt-2 text-sm text-ink-soft">Resources submitted while signed in will appear here. Older anonymous submissions aren’t linked to your account.</p></div> : <ul className="mt-6 space-y-3">{data.map(item => <li key={item.id} className="rounded-2xl border border-rule bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">{item.title}</h2><p className="mt-1 text-sm text-ink-soft">{item.organization} · {item.county}</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{item.status === "approved" ? "Published" : item.status === "pending" ? "Awaiting review" : "Not approved"}</span></div>{item.moderator_note && <p className="mt-4 rounded-lg bg-ground p-3 text-sm text-ink-soft">Reviewer note: {item.moderator_note}</p>}</li>)}</ul>}</>;
}
export function PartnerAddResource() { return <Access><AddResourcePage partnerMode /></Access>; }
export function PartnerCoverage() { return <><Heading eyebrow="Directory intelligence" title="Where information is available">Use these counts to guide directory research. They do not measure open places, eligibility matches, or unmet community demand.</Heading><Coverage /><div className="mt-6 rounded-2xl border border-rule bg-surface p-6"><h2 className="text-lg font-semibold">Turn a question into a contribution</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">A low count is a starting point for investigation. Confirm which services exist locally, whether they are accepting referrals, and what information is missing.</p><Link to="/partners/add-resource" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-brand">Share what you find <ArrowRight className="size-4" /></Link></div></>; }
export function PartnerReview() { const { partner } = usePartner(); return <><Heading eyebrow="Verification" title="Review queue">Check the official source and required details before making a resource visible to young people.</Heading><Access reviewer>{partner && <div className="mt-8"><Queue reviewer={partner} /></div>}</Access></>; }
export function PartnerGuide() { return <><Heading eyebrow="Partner guide · AI" title="A second set of questions." >Get help drafting a service description or preparing a verification checklist. Review every suggestion before using it.</Heading><Access><Guide /></Access></>; }
function Guide() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setReply(""); setError(""); try { setReply((await askPartnerGuide(message)).reply); } catch { setError("The partner guide is unavailable right now. Your question is still here; you can retry or continue drafting your resource."); } finally { setBusy(false); } };
  return <div className="mt-8 max-w-[800px]"><div className="rounded-2xl border border-rule bg-surface p-5"><p className="text-sm leading-relaxed text-ink-soft">Use general or public service information. Don’t include a young person’s name, case details, or private records. This guide cannot publish resources or access youth plans. Questions are sent to the configured AI provider. Each question is handled independently.</p></div><div className="mt-5 flex flex-wrap gap-2">{["What should I verify before listing a housing program?", "Help me outline a new transportation resource.", "How can I help a young person prepare questions for a service provider?"].map(prompt => <button key={prompt} onClick={() => setMessage(prompt)} className="min-h-11 rounded-xl border border-rule bg-surface px-4 py-3 text-left text-sm text-brand hover:border-brand">{prompt}</button>)}</div><form onSubmit={event => { event.preventDefault(); void submit(); }} className="mt-6"><label htmlFor="partner-question" className="text-sm font-semibold text-ink">What are you working on?</label><Textarea id="partner-question" className="mt-2 min-h-36 rounded-xl bg-surface text-base" maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} /><Button disabled={busy || message.trim().length < 3} className="mt-3 min-h-12 rounded-xl px-5">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Preparing suggestions…" : "Ask partner guide"}</Button></form>{error && <p role="alert" className="mt-5 rounded-xl bg-sand-soft p-4 text-sm text-ink">{error}</p>}{reply && <section aria-live="polite" className="mt-6 rounded-2xl border border-rule bg-surface p-6"><h2 className="text-sm font-semibold text-brand">Draft guidance · review before use</h2><p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{reply}</p></section>}</div>;
}

export function PartnerSignIn() { const { partner } = usePartner(); return <><Heading eyebrow="Partner account" title={partner ? "You’re signed in." : "Welcome to your workspace."}>Sign in to contribute resources and follow their progress through review.</Heading><Access><Link to="/partners" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">Go to overview</Link></Access></>; }
