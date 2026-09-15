import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Loader2, X } from "lucide-react";
import {
  fetchPartnerAnalytics, fetchSubmissions, partnerLogin, reviewSubmission,
  type ApprovalDetail, type PartnerIdentity, type Submission,
} from "@/lib/api";
import { describeChecked } from "@/lib/checked";
import { Stat, ago } from "./PartnerPages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/primitives/Chip";
import { toast } from "sonner";

/**
 * Coverage: what the directory holds, how fresh it is, what's missing from
 * each listing, the review pipeline, and what young people have flagged.
 * Every number describes listings, never open beds or eligibility.
 */
export function Coverage() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["partner-analytics"], queryFn: fetchPartnerAnalytics, retry: 1 });
  const [county, setCounty] = useState("All");
  if (isPending) return <div role="status" className="rounded-md border border-rule bg-surface p-6 text-ink-soft">Loading directory coverage…</div>;
  if (isError || !data) {
    return (
      <div role="status" className="rounded-md border border-rule bg-surface p-6">
        <h2 className="font-semibold text-ink">Coverage is temporarily unavailable</h2>
        <p className="mt-2 text-sm text-ink-soft">We couldn&rsquo;t load the directory totals. Try again to see current coverage.</p>
        <Button variant="outline" className="mt-4 h-11 rounded-md border-ink" onClick={() => { void refetch(); }}>Try again</Button>
      </div>
    );
  }

  const n = (value: unknown) => Number(value ?? 0);
  const verified = n(data.totals.verified);
  const counties = data.byCounty.map(row => row.county);
  const matrixFor = (category: string) => county === "All"
    ? n(data.byCategory.find(row => row.category === category)?.count)
    : n(data.matrix.find(row => row.category === category && row.county === county)?.count);
  const rows = data.byCategory.map(row => ({ ...row, shown: matrixFor(row.category) })).sort((a, b) => b.shown - a.shown);
  const max = Math.max(1, ...rows.map(row => row.shown));
  const fresh = n(data.freshness.fresh), aging = n(data.freshness.aging), stale = n(data.freshness.stale);
  const completeness: [string, number][] = [
    ["Has a phone number", n(data.completeness.phone)],
    ["Has a website", n(data.completeness.website)],
    ["Cost is stated", n(data.completeness.cost_known)],
    ["Age range is known", n(data.completeness.age_known)],
    ["Hours listed", n(data.completeness.hours)],
    ["Address listed", n(data.completeness.address)],
    ["Languages listed", n(data.completeness.languages)],
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published listings" value={verified} detail={`${n(data.totals.retired)} retired`} />
        <Stat label="Checked in last 30 days" value={n(data.totals.checked_last_30)} detail={`${n(data.totals.publishedLast30)} newly published`} tone="green" />
        <Stat label="Need a re-check" value={stale} detail="Older than 180 days" tone={stale ? "rust" : "ink"} />
        <Stat label="Awaiting review" value={n(data.pipeline.pending)} detail={n(data.pipeline.pending_over_week) ? `${n(data.pipeline.pending_over_week)} waiting over a week` : "None over a week"} tone={n(data.pipeline.pending_over_week) ? "rust" : "ink"} />
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-bold text-ink">By kind of support</h2>
            <p className="mt-1 text-[14px] text-ink-faint">Listings, how many are free, how many still have no cost, and how many need a re-check.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={county === "All"} onClick={() => setCounty("All")} className="min-h-9 text-[13px]">All regions</Chip>
            {counties.map(item => <Chip key={item} selected={county === item} onClick={() => setCounty(item)} className="min-h-9 text-[13px]">{item}</Chip>)}
          </div>
        </div>
        <div className="mt-4 hidden grid-cols-[200px_1fr_56px_56px_56px_72px] gap-3 pb-2 text-eyebrow text-ink-faint md:grid">
          <span>Kind</span><span /><span className="text-right">Total</span><span className="text-right">Free</span><span className="text-right">Cost ?</span><span className="text-right">Re-check</span>
        </div>
        <ul className="divide-y divide-rule border-t border-rule">
          {rows.map(row => (
            <li key={row.category} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-[14px] md:grid-cols-[200px_1fr_56px_56px_56px_72px]">
              <span className="text-ink-soft">{row.category}</span>
              <div className="col-span-2 h-2.5 rounded-sm bg-brand-soft md:col-span-1"><div className="h-2.5 rounded-sm bg-brand" style={{ width: `${(row.shown / max) * 100}%` }} /></div>
              <span className="tabular text-right font-semibold text-ink">{row.shown}</span>
              <span className="tabular hidden text-right text-green md:block">{n(row.free)}</span>
              <span className="tabular hidden text-right text-ink-faint md:block">{n(row.cost_unknown)}</span>
              <span className={`tabular hidden text-right md:block ${n(row.stale) ? "text-crisis" : "text-ink-faint"}`}>{n(row.stale)}</span>
            </li>
          ))}
        </ul>
        {county !== "All" && <p className="mt-2 text-[13px] text-ink-faint">Free / cost / re-check columns are directory-wide; the bar and total are for {county}.</p>}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-[22px] font-bold text-ink">By region</h2>
          <ul className="mt-3 divide-y divide-rule border-t border-rule">
            {data.byCounty.map(row => (
              <li key={row.county} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 py-2.5 text-[14px]">
                <span className="text-ink-soft">{row.county}</span>
                <div className="h-2.5 rounded-sm bg-brand-soft"><div className="h-2.5 rounded-sm bg-brand" style={{ width: `${(n(row.count) / Math.max(1, ...data.byCounty.map(r => n(r.count)))) * 100}%` }} /></div>
                <span className="tabular text-right font-semibold text-ink">{n(row.count)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-faint">Statewide and national programs may also serve each county.</p>
        </section>

        <section>
          <h2 className="font-display text-[22px] font-bold text-ink">Freshness</h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-sunk">
            <div className="bg-green" style={{ width: `${(fresh / Math.max(1, verified)) * 100}%` }} />
            <div className="bg-sand" style={{ width: `${(aging / Math.max(1, verified)) * 100}%` }} />
            <div className="bg-crisis" style={{ width: `${(stale / Math.max(1, verified)) * 100}%` }} />
          </div>
          <ul className="mt-3 divide-y divide-rule border-t border-rule text-[14px]">
            {([["Checked in the last 90 days", fresh, "bg-green"], ["90–180 days", aging, "bg-sand"], ["Older than 180 days", stale, "bg-crisis"]] as const).map(([label, count, dot]) => (
              <li key={label} className="flex items-center justify-between py-2.5"><span className="flex items-center gap-2 text-ink-soft"><span className={`size-2.5 rounded-full ${dot}`} />{label}</span><span className="tabular font-semibold text-ink">{count}</span></li>
            ))}
          </ul>
          <a href="#recheck" className="mt-2 inline-block text-[14px] text-brand hover:underline">See the oldest listings ↓</a>
        </section>
      </div>

      <section>
        <h2 className="font-display text-[22px] font-bold text-ink">What listings are missing</h2>
        <p className="mt-1 text-[14px] text-ink-faint">Share of published listings with each field filled in. Gaps here are the fastest way to make the directory more useful.</p>
        <ul className="mt-3 divide-y divide-rule border-t border-rule">
          {completeness.map(([label, count]) => {
            const pct = Math.round((count / Math.max(1, verified)) * 100);
            return (
              <li key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-[14px] sm:grid-cols-[220px_1fr_64px]">
                <span className="text-ink-soft">{label}</span>
                <div className="col-span-2 h-2.5 rounded-sm bg-sunk sm:col-span-1"><div className={`h-2.5 rounded-sm ${pct < 50 ? "bg-crisis" : pct < 80 ? "bg-sand" : "bg-brand"}`} style={{ width: `${pct}%` }} /></div>
                <span className="tabular text-right font-semibold text-ink">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section id="recheck">
          <h2 className="font-display text-[22px] font-bold text-ink">Oldest checks</h2>
          <p className="mt-1 text-[14px] text-ink-faint">Start here when re-verifying. {data.staleList.length} shown, oldest first.</p>
          <ul className="mt-3 divide-y divide-rule border-t border-rule">
            {data.staleList.map(item => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{item.title}</p><p className="truncate text-[13px] text-ink-faint">{item.organization} · {item.category} · {item.county}</p></div>
                <span className={`text-stamp shrink-0 ${describeChecked(item.verified_at).stale ? "text-crisis" : ""}`}>{item.verified_at}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="reports">
          <h2 className="font-display text-[22px] font-bold text-ink">Flagged by young people</h2>
          <p className="mt-1 text-[14px] text-ink-faint">Reports sent from a listing&rsquo;s &ldquo;something is wrong&rdquo; link. Treat the text as a lead, not a verified fact.</p>
          {data.reports.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-rule p-5 text-[14px] text-ink-soft">No reports yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-t border-rule">
              {data.reports.map(report => (
                <li key={report.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3"><p className="truncate text-[15px] font-semibold text-ink">{report.title}</p><span className="text-stamp shrink-0">{ago(report.created_at)}</span></div>
                  <p className="mt-1 text-[14px] text-ink-soft">&ldquo;{report.reason}&rdquo;</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid gap-3 rounded-md border border-rule bg-surface p-6 sm:grid-cols-4">
        <div className="sm:col-span-4"><h2 className="font-display text-[20px] font-bold text-ink">Review pipeline</h2></div>
        <Pipe label="Submitted, last 30 days" value={n(data.pipeline.submitted_last_30)} />
        <Pipe label="Awaiting review" value={n(data.pipeline.pending)} />
        <Pipe label="Published" value={n(data.pipeline.approved)} />
        <Pipe label="Not approved" value={n(data.pipeline.rejected)} />
      </section>

      <p className="text-[12px] text-ink-faint">Counts computed {new Date(data.generatedAt).toLocaleString()}. They describe the directory, not services on the ground.</p>
    </div>
  );
}

function Pipe({ label, value }: { label: string; value: number }) {
  return <div><p className="text-eyebrow text-ink-faint">{label}</p><p className="tabular mt-1 font-display text-[28px] font-bold leading-none text-ink">{value}</p></div>;
}

export function SignIn({ onSignedIn, reviewer = false }: { onSignedIn: (partner: PartnerIdentity) => void; reviewer?: boolean }) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await partnerLogin(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-[420px] rounded-md border border-rule bg-surface p-6 sm:p-8">
      <h2 className="font-display text-[26px] font-bold text-ink">{reviewer ? "Reviewer sign-in" : "Sign in"}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
        {reviewer ? "Reviewer accounts approve listings and changes. Contributor accounts work here too." : "Sign in to submit resources, fill gaps, and use the staff guide."}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={emailId} className="text-[13px] font-semibold text-ink-soft">Work email</label>
          <Input
            id={emailId}
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base"
          />
        </div>
        <div>
          <label htmlFor={passwordId} className="text-[13px] font-semibold text-ink-soft">Password</label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base"
          />
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md bg-crisis-soft px-4 py-3 text-[14px] text-crisis">{error}</p>}

      <Button
        type="submit"
        disabled={busy || !email || !password}
        className="mt-5 h-12 w-full rounded-md bg-brand text-base font-semibold text-white hover:bg-brand-deep"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? "Signing in" : "Sign in"}
      </Button>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
        Accounts are created by Foster Connect — there&rsquo;s no self sign-up. Contact your coordinator to join your organization. You can still share a resource without signing in.
      </p>
    </form>
  );
}

export function Queue({ reviewer }: { reviewer: PartnerIdentity }) {
  const { data: submissions = [], isPending, isError, refetch } = useQuery({
    queryKey: ["partner-submissions", reviewer.email],
    queryFn: fetchSubmissions,
    retry: 1,
  });

  if (isPending) {
    return <div className="rounded-md border border-rule bg-surface p-10 text-center text-ink-soft">Loading the queue…</div>;
  }
  if (isError) {
    return (
      <div className="rounded-md border border-rule bg-surface p-10 text-center">
        <p className="text-ink-soft">Could not load the queue.</p>
        <Button variant="outline" className="mt-4 rounded-md border-ink" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const pending = submissions.filter(item => item.status === "pending");
  const reviewed = submissions.filter(item => item.status !== "pending");

  return (
    <div>
      <h2 className="font-display text-[22px] font-bold text-ink">
        {pending.length} waiting on you
      </h2>

      {pending.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-rule bg-surface p-10 text-center text-[14.5px] text-ink-soft">
          Nothing in the queue. Community submissions land here before anyone can see them.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {pending.map(submission => (
            <SubmissionCard key={submission.id} submission={submission} reviewer={reviewer} onDone={() => refetch()} />
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-[20px] font-bold text-ink">Already reviewed</h2>
          <ul className="mt-4 divide-y divide-rule-soft overflow-hidden rounded-md border border-rule bg-surface">
            {reviewed.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-faint">
                    {item.status === "approved" ? "Published" : "Rejected"} by {item.reviewed_by || "unknown"}
                    {item.resource_id ? ` · resource #${item.resource_id}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    item.status === "approved" ? "bg-green-soft text-green" : "bg-sunk text-ink-faint"
                  }`}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const EMPTY_DETAIL: ApprovalDetail = {
  eligibility: "",
  cost: "",
  applicationSteps: "",
  whatToBring: "",
  phone: "",
  hours: "",
  urgencyLevel: "Standard",
  isCrisis: false,
};

function SubmissionCard({
  submission, reviewer, onDone,
}: { submission: Submission; reviewer: PartnerIdentity; onDone: () => void }) {
  const [approving, setApproving] = useState(false);
  const [detail, setDetail] = useState<ApprovalDetail>({ ...EMPTY_DETAIL, phone: submission.contact || "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const ready =
    detail.eligibility.trim().length >= 3 &&
    detail.cost.trim().length >= 1 &&
    detail.applicationSteps.trim().length >= 3;

  const act = async (status: "approved" | "rejected") => {
    setBusy(true);
    try {
      const result = await reviewSubmission(
        submission.id, status, note, status === "approved" ? detail : undefined,
      );
      toast.success(
        status === "approved"
          ? `Published as resource #${result.resourceId}. It's searchable now.`
          : "Rejected. It stays out of the directory.",
      );
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-md border border-rule bg-surface p-5 lg:p-6">
      <h3 className="font-display text-[22px] font-bold text-ink">{submission.title}</h3>
      <p className="mt-1 text-[13.5px] text-ink-faint">
        {submission.organization} · {submission.category} · {submission.county}{submission.kind === "information" && " · Guide / document"}
      </p>
      {submission.kind === "information" && (
        <p className="mt-2 text-[13px] text-ink-soft">Submitted as a guide, not a service: hours, phone, address and languages are not shown to young people, so leave them blank unless they apply.</p>
      )}
      <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-soft">{submission.description}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-eyebrow text-ink-faint">Submitted by</dt>
          <dd className="mt-1 text-[14px] text-ink-soft">
            {submission.submitter_name || "Anonymous"} — {submission.relationship}
          </dd>
        </div>
        <div>
          <dt className="text-eyebrow text-ink-faint">Check these</dt>
          <dd className="mt-1 flex flex-wrap gap-3 text-[14px]">
            <a href={submission.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand underline underline-offset-2">
              Programme page <ExternalLink className="size-3.5" />
            </a>
            <a href={submission.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand underline underline-offset-2">
              Source <ExternalLink className="size-3.5" />
            </a>
          </dd>
        </div>
      </dl>

      {!approving ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setApproving(true)} className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep">
            <Check className="size-4" />
            Approve and publish
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => act("rejected")} className="h-11 rounded-md border-rule px-5">
            <X className="size-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-6 border-t border-rule pt-5">
          <div className="flex items-start gap-2.5 rounded-md bg-sand-soft p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sand" />
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Publishing puts this in front of young people. Fill these in from the official
              page — don&apos;t guess. If you can&apos;t confirm something, say so in plain words
              rather than leaving it hopeful.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <Field
              label="Who may qualify"
              hint="Age, county, care status, income — whatever they actually check."
              value={detail.eligibility}
              onChange={value => setDetail({ ...detail, eligibility: value })}
              multiline
              required
            />
            <Field
              label="Cost"
              hint='"Free", "Sliding scale", "$40 per session"'
              value={detail.cost}
              onChange={value => setDetail({ ...detail, cost: value })}
              required
            />
            <Field
              label="How to start"
              hint="The first concrete step. Call who, fill in what, walk in where."
              value={detail.applicationSteps}
              onChange={value => setDetail({ ...detail, applicationSteps: value })}
              multiline
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What to bring" value={detail.whatToBring || ""} onChange={value => setDetail({ ...detail, whatToBring: value })} />
              <Field label="Phone" value={detail.phone || ""} onChange={value => setDetail({ ...detail, phone: value })} />
              <Field label="Hours" value={detail.hours || ""} onChange={value => setDetail({ ...detail, hours: value })} />
              <Field label="Languages" value={detail.languages || ""} onChange={value => setDetail({ ...detail, languages: value })} />
            </div>

            <div>
              <p className="text-[13px] font-medium text-ink-soft">How urgent</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Standard", "Urgent", "Emergency"] as const).map(level => (
                  <Chip
                    key={level}
                    selected={detail.urgencyLevel === level}
                    onClick={() => setDetail({ ...detail, urgencyLevel: level })}
                  >
                    {level}
                  </Chip>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-crisis/25 bg-crisis-soft p-4">
              <input
                type="checkbox"
                checked={Boolean(detail.isCrisis)}
                onChange={event => setDetail({ ...detail, isCrisis: event.target.checked })}
                className="mt-1 size-4 shrink-0 accent-[var(--crisis)]"
              />
              <span className="text-[13.5px] leading-relaxed text-ink-soft">
                <strong className="font-semibold text-ink">This is a crisis line or emergency service.</strong>{" "}
                Only tick this if it answers around the clock and can help someone in immediate
                danger. Crisis-flagged resources are what we show when someone says they are not safe.
              </span>
            </label>

            <Field label="Note for the record" hint="Optional. Saved to the audit log." value={note} onChange={setNote} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              disabled={!ready || busy}
              onClick={() => act("approved")}
              className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Publish as {reviewer.name}
            </Button>
            <Button variant="outline" onClick={() => setApproving(false)} className="h-11 rounded-md border-rule px-5">
              Cancel
            </Button>
            {!ready && (
              <span className="text-[13px] text-ink-faint">
                Eligibility, cost, and how to start are required.
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function Field({
  label, hint, value, onChange, multiline, required,
}: {
  label: string; hint?: string; value: string; onChange: (value: string) => void;
  multiline?: boolean; required?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
        {required && <span className="ml-1 text-crisis">*</span>}
      </label>
      {hint && <p id={hintId} className="mt-0.5 text-[12.5px] text-ink-faint">{hint}</p>}
      {multiline ? (
        <Textarea
          id={id}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="mt-1.5 min-h-20 rounded-md border-rule text-base"
        />
      ) : (
        <Input
          id={id}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base"
        />
      )}
    </div>
  );
}
