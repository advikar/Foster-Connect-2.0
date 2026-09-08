import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Loader2, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import {
  fetchSubmissions, partnerLogin, reviewSubmission,
  type ApprovalDetail, type PartnerIdentity, type Submission,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/primitives/Chip";
import { toast } from "sonner";

interface Analytics {
  category: { category: string; count: number }[];
  county: { county: string; count: number }[];
  totals: { verified: number; crisis: number };
}

async function analytics() {
  const response = await fetch(`${API_BASE_URL}/api/analytics`);
  if (!response.ok) throw new Error("Could not load coverage");
  return response.json() as Promise<Analytics>;
}

export function Coverage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["analytics"], queryFn: analytics });
  if (isLoading) return <div role="status" className="mt-8 rounded-2xl border border-rule bg-surface p-6 text-ink-soft">Loading directory coverage…</div>;
  if (isError) return <div role="status" className="mt-8 rounded-2xl border border-rule bg-surface p-6"><h2 className="font-semibold text-ink">Coverage is temporarily unavailable</h2><p className="mt-2 text-sm text-ink-soft">We couldn’t load the directory totals. Try again to see current coverage.</p><Button variant="outline" className="mt-4 min-h-11" onClick={() => { void refetch(); }}>Try again</Button></div>;
  const max = Math.max(...(data?.category.map(item => Number(item.count)) || [1]), 1);

  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Published resources" value={Number(data?.totals.verified || 0)} />
        <Metric label="Flagged as crisis" value={Number(data?.totals.crisis || 0)} />
        <Metric label="Regions represented" value={data?.county.length || 0} />
      </div>

      <div className="mt-4 rounded-2xl border border-rule bg-surface p-6">
        <h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Coverage by need</h2>
        <p className="mt-1 text-[13.5px] text-ink-soft">Listing counts show directory coverage, not service availability or unmet demand.</p>
        <ul className="mt-5 space-y-3">
          {data?.category.map(item => (
            <li key={item.category}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="font-medium text-ink-soft">{item.category}</span>
                <span className="tabular text-ink-faint">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sunk">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(Number(item.count) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-2xl border border-rule bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Coverage by region</h2>
        <p className="mt-1 text-sm text-ink-soft">Records grouped by their listed region. Statewide and regional programs may also serve individual counties.</p>
        <ul className="mt-4 divide-y divide-rule">{data?.county.map(item => <li key={item.county} className="flex justify-between gap-4 py-3 text-sm"><span>{item.county}</span><span className="font-semibold tabular-nums text-brand">{item.count}</span></li>)}</ul>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-rule bg-surface p-5">
      <p className="tabular font-display text-[30px] font-bold tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-ink-soft">{label}</p>
    </div>
  );
}

export function SignIn({ onSignedIn }: { onSignedIn: (partner: PartnerIdentity) => void }) {
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
    <form onSubmit={submit} className="max-w-[420px] rounded-2xl border border-rule bg-surface p-6">
      <h2 className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">Sign in</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
        Sign in to submit resources, track review status, and use the partner guide.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={emailId} className="text-[13px] font-medium text-ink-soft">Email</label>
          <Input
            id={emailId}
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="mt-1.5 h-12 rounded-xl border-rule text-base"
          />
        </div>
        <div>
          <label htmlFor={passwordId} className="text-[13px] font-medium text-ink-soft">Password</label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="mt-1.5 h-12 rounded-xl border-rule text-base"
          />
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-crisis-soft px-4 py-3 text-[13.5px] text-crisis">{error}</p>}

      <Button
        type="submit"
        disabled={busy || !email || !password}
        className="mt-5 h-12 w-full rounded-xl bg-brand text-base font-semibold text-on-brand hover:opacity-90"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? "Signing in" : "Sign in"}
      </Button>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
        Partner access is by invitation. Contact your Foster Connect coordinator to join your organization. You can still share a resource without signing in.
      </p>
    </form>
  );
}

export function Queue({ reviewer }: { reviewer: PartnerIdentity }) {
  const { data: submissions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["partner-submissions", reviewer.email],
    queryFn: fetchSubmissions,
    retry: 1,
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-rule bg-surface p-10 text-center text-ink-soft">Loading the queue…</div>;
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-rule bg-surface p-10 text-center">
        <p className="text-ink-soft">Could not load the queue.</p>
        <Button variant="outline" className="mt-4 rounded-full border-rule" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const pending = submissions.filter(item => item.status === "pending");
  const reviewed = submissions.filter(item => item.status !== "pending");

  return (
    <div>
      <h2 className="font-display text-[22px] font-bold tracking-[-0.025em] text-ink">
        {pending.length} waiting on you
      </h2>

      {pending.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-rule bg-surface p-10 text-center text-[14.5px] text-ink-soft">
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
          <h2 className="font-display text-[19px] font-bold tracking-[-0.025em] text-ink">Already reviewed</h2>
          <ul className="mt-4 divide-y divide-rule-soft overflow-hidden rounded-2xl border border-rule bg-surface">
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
    <article className="rounded-2xl border border-rule bg-surface p-5 lg:p-6">
      <h3 className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">{submission.title}</h3>
      <p className="mt-1 text-[13.5px] text-ink-faint">
        {submission.organization} · {submission.category} · {submission.county}
      </p>
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
          <Button onClick={() => setApproving(true)} className="h-11 rounded-xl bg-brand px-5 font-semibold text-on-brand hover:opacity-90">
            <Check className="size-4" />
            Approve and publish
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => act("rejected")} className="h-11 rounded-xl border-rule px-5">
            <X className="size-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-6 border-t border-rule pt-5">
          <div className="flex items-start gap-2.5 rounded-xl bg-sand-soft p-4">
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

            <label className="flex items-start gap-3 rounded-xl border border-crisis/25 bg-crisis-soft p-4">
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
              className="h-11 rounded-xl bg-brand px-5 font-semibold text-on-brand hover:opacity-90"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Publish as {reviewer.name}
            </Button>
            <Button variant="outline" onClick={() => setApproving(false)} className="h-11 rounded-xl border-rule px-5">
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
          className="mt-1.5 min-h-20 rounded-xl border-rule text-base"
        />
      ) : (
        <Input
          id={id}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="mt-1.5 h-12 rounded-xl border-rule text-base"
        />
      )}
    </div>
  );
}
