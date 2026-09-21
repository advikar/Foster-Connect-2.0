import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchPartnerAnalytics, fetchResourceChanges, fetchSubmissions, partnerLogin, partnerRegister, requestPasswordReset, reviewResourceChange, reviewSubmission,
  type ApprovalDetail, type PartnerIdentity, type ResourceChange, type Submission,
} from "@/lib/api";
import { ListingDrawer, type DrawerFilter } from "@/components/partners/ListingDrawer";
import { ReportsPanel } from "@/components/partners/ReportsPanel";
import { usePartner } from "@/contexts/PartnerContext";
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
  const { partner } = usePartner();
  const reviewer = partner?.role === "reviewer";
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["partner-analytics"], queryFn: fetchPartnerAnalytics, retry: 1 });
  // Multi-select regions (P4): empty = all.
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<DrawerFilter | null>(null);
  const toggleCounty = (name: string) => setSelected(previous => previous.includes(name) ? previous.filter(item => item !== name) : [...previous, name]);
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
  const countyParam = selected.length ? selected.join(",") : undefined;
  const countyLabel = selected.length ? selected.join(" + ") : "all regions";
  const matrixFor = (category: string) => selected.length === 0
    ? n(data.byCategory.find(row => row.category === category)?.count)
    : data.matrix.filter(row => row.category === category && selected.includes(row.county)).reduce((sum, row) => sum + n(row.count), 0);
  const rows = data.byCategory.map(row => ({ ...row, shown: matrixFor(row.category) })).sort((a, b) => b.shown - a.shown);
  const max = Math.max(1, ...rows.map(row => row.shown));
  const fresh = n(data.freshness.fresh), aging = n(data.freshness.aging), stale = n(data.freshness.stale);
  const gaps = 7 * verified - [data.completeness.phone, data.completeness.website, data.completeness.cost_known, data.completeness.age_known, data.completeness.hours, data.completeness.address, data.completeness.languages].reduce((sum, value) => sum + n(value), 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published listings" value={verified} detail={`${n(data.totals.retired)} retired`} />
        <Stat label="Checked in last 30 days" value={n(data.totals.checked_last_30)} detail={`${n(data.totals.publishedLast30)} newly published`} tone="green" />
        <Stat label="Need a re-check" value={stale} detail="Older than 180 days, or past their re-check date" tone={stale ? "rust" : "ink"} />
        <Stat label="Awaiting review" value={n(data.pipeline.pending)} detail={n(data.pipeline.pending_over_week) ? `${n(data.pipeline.pending_over_week)} waiting over a week` : "None over a week"} tone={n(data.pipeline.pending_over_week) ? "rust" : "ink"} />
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-bold text-ink">By kind of support</h2>
            <p className="mt-1 text-[14px] text-ink-faint">Listings, how many are free, how many still have no cost, and how many need a re-check.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={selected.length === 0} onClick={() => setSelected([])} className="min-h-9 text-[13px]">All regions</Chip>
            {counties.map(item => <Chip key={item} selected={selected.includes(item)} onClick={() => toggleCounty(item)} className="min-h-9 text-[13px]">{item}</Chip>)}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">Pick more than one region to add them up. Tap a bar to see the listings behind it and fix any of them.</p>
        <div className="mt-4 hidden grid-cols-[200px_1fr_56px_56px_56px_72px] gap-3 pb-2 text-eyebrow text-ink-faint md:grid">
          <span>Kind</span><span /><span className="text-right">Total</span><span className="text-right">Free</span><span className="text-right">Cost ?</span><span className="text-right">Re-check</span>
        </div>
        <ul className="divide-y divide-rule border-t border-rule">
          {rows.map(row => (
            <li key={row.category}>
              <button
                type="button"
                onClick={() => setDrawer({ title: row.category, detail: `Published listings · ${countyLabel}`, category: row.category, county: countyParam })}
                className="row-hover -mx-2 grid w-[calc(100%+16px)] grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left text-[14px] md:grid-cols-[200px_1fr_56px_56px_56px_72px]"
                aria-label={`${row.category}: ${row.shown} listings. Open the list.`}
              >
                <span className="text-ink-soft">{row.category}</span>
                <div className="col-span-2 h-2.5 rounded-sm bg-brand-soft md:col-span-1"><div className="h-2.5 rounded-sm bg-brand" style={{ width: `${(row.shown / max) * 100}%` }} /></div>
                <span className="tabular text-right font-semibold text-ink">{row.shown}</span>
                <span className="tabular hidden text-right text-green md:block">{n(row.free)}</span>
                <span className="tabular hidden text-right text-ink-faint md:block">{n(row.cost_unknown)}</span>
                <span className={`tabular hidden text-right md:block ${n(row.stale) ? "text-crisis" : "text-ink-faint"}`}>{n(row.stale)}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected.length > 0 && <p className="mt-2 text-[13px] text-ink-faint">Free / cost / re-check columns are directory-wide; the bar and total are for {countyLabel}.</p>}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-[22px] font-bold text-ink">By region</h2>
          <ul className="mt-3 divide-y divide-rule border-t border-rule">
            {data.byCounty.map(row => (
              <li key={row.county}>
                <button type="button" onClick={() => setDrawer({ title: row.county, detail: "Published listings filed under this region", county: row.county })} className="row-hover -mx-2 grid w-[calc(100%+16px)] grid-cols-[140px_1fr_48px] items-center gap-3 rounded-md px-2 py-2.5 text-left text-[14px]" aria-label={`${row.county}: ${n(row.count)} listings. Open the list.`}>
                  <span className="text-ink-soft">{row.county}</span>
                  <div className="h-2.5 rounded-sm bg-brand-soft"><div className="h-2.5 rounded-sm bg-brand" style={{ width: `${(n(row.count) / Math.max(1, ...data.byCounty.map(r => n(r.count)))) * 100}%` }} /></div>
                  <span className="tabular text-right font-semibold text-ink">{n(row.count)}</span>
                </button>
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
          <button type="button" onClick={() => setDrawer({ title: "Needs a re-check", detail: "Older than 180 days or past their re-check date", stale: true })} className="mt-2 inline-block text-[14px] text-brand hover:underline">See every listing that needs a re-check →</button>
        </section>
      </div>

      <section className="rounded-md bg-sand-soft p-5">
        <h2 className="font-display text-[20px] font-bold text-ink">{gaps} fields still blank across the directory</h2>
        <p className="mt-1 text-[14px] text-ink-soft">Phone numbers, costs, hours and more. Filling one takes a minute and makes a listing usable.</p>
        <Link to="/partners/gaps" className="mt-2 inline-flex min-h-10 items-center text-[14px] font-semibold text-brand hover:underline">Fill the gaps →</Link>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section id="recheck">
          <h2 className="font-display text-[22px] font-bold text-ink">Oldest checks</h2>
          <p className="mt-1 text-[14px] text-ink-faint">Start here when re-verifying. {data.staleList.length} shown, oldest first. Tap one to check it and save.</p>
          <ul className="mt-3 divide-y divide-rule border-t border-rule">
            {data.staleList.map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => setDrawer({ title: item.title, detail: `Last checked ${item.verified_at}`, resourceId: item.id })} className="row-hover -mx-2 flex w-[calc(100%+16px)] items-baseline justify-between gap-3 rounded-md px-2 py-2.5 text-left">
                  <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{item.title}</p><p className="truncate text-[13px] text-ink-faint">{item.organization !== item.title ? `${item.organization} · ` : ""}{item.category} · {item.county}{item.recheck_at ? ` · re-check by ${item.recheck_at}` : ""}</p></div>
                  <span className={`text-stamp shrink-0 ${describeChecked(item.verified_at, "online", item.recheck_at).stale ? "text-crisis" : ""}`}>{item.verified_at}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section id="reports">
          <h2 className="font-display text-[22px] font-bold text-ink">Flagged by young people</h2>
          <p className="mt-1 text-[14px] text-ink-faint">Reports sent from a listing&rsquo;s &ldquo;something is wrong&rdquo; link. Treat the text as a lead, not a verified fact. Open the listing to re-check and correct it.</p>
          <ReportsPanel reports={data.reports} reviewer={reviewer} onOpen={report => setDrawer({ title: report.title, detail: `Youth report: “${report.reason}”`, resourceId: report.resource_id })} />
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
      <ListingDrawer filter={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/**
 * Fill the gaps (P5): every field that is blank on a published listing, as a
 * bar you can open. Contributors send fixes for review; reviewers apply them.
 */
export function Gaps({ reviewer }: { reviewer: boolean }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["partner-analytics"], queryFn: fetchPartnerAnalytics, retry: 1 });
  const [drawer, setDrawer] = useState<DrawerFilter | null>(null);
  if (isPending) return <div role="status" className="rounded-md border border-rule bg-surface p-6 text-ink-soft">Counting what&rsquo;s missing…</div>;
  if (isError || !data) {
    return (
      <div role="status" className="rounded-md border border-rule bg-surface p-6">
        <p className="text-sm text-ink-soft">We couldn&rsquo;t load the directory totals.</p>
        <Button variant="outline" className="mt-4 h-11 rounded-md border-ink" onClick={() => { void refetch(); }}>Try again</Button>
      </div>
    );
  }
  const n = (value: unknown) => Number(value ?? 0);
  const verified = n(data.totals.verified);
  const fields: { key: DrawerFilter["missing"] & string; label: string; known: number }[] = [
    { key: "phone", label: "Phone number", known: n(data.completeness.phone) },
    { key: "cost", label: "Cost", known: n(data.completeness.cost_known) },
    { key: "age", label: "Age range", known: n(data.completeness.age_known) },
    { key: "hours", label: "Hours", known: n(data.completeness.hours) },
    { key: "address", label: "Address", known: n(data.completeness.address) },
    { key: "languages", label: "Languages", known: n(data.completeness.languages) },
    { key: "website", label: "Website", known: n(data.completeness.website) },
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-[64ch] rounded-md bg-sand-soft p-5 text-[15px] leading-relaxed text-ink-soft">
        {reviewer ? (
          <p>Each bar is a field that some published listings are missing. Open one, pick a listing, and fill it in — your edits publish immediately and record today as the check date. Proposals from partners wait for you in the <Link to="/partners/review" className="font-semibold text-brand hover:underline">review queue</Link>.</p>
        ) : (
          <p>Thank you for helping. Each bar is a field that some published listings are missing. If you know the answer — a phone number, whether it&rsquo;s free, the hours — open the bar, pick the listing and fill it in. A reviewer checks every change before young people see it. If the program genuinely has no phone line or no set hours, say so; that is useful too.</p>
        )}
      </div>
      <section>
        <h2 className="font-display text-[22px] font-bold text-ink">What&rsquo;s missing, by field</h2>
        <p className="mt-1 text-[14px] text-ink-faint">Share of {verified} published listings where the field is filled in or confirmed not to apply. Tap a bar to see the listings still missing it.</p>
        <ul className="mt-3 divide-y divide-rule border-t border-rule">
          {fields.map(field => {
            const pct = Math.round((field.known / Math.max(1, verified)) * 100);
            const missing = verified - field.known;
            return (
              <li key={field.key}>
                <button
                  type="button"
                  onClick={() => setDrawer({ title: `Missing: ${field.label.toLowerCase()}`, detail: `${missing} listings without a ${field.label.toLowerCase()} on record`, missing: field.key })}
                  className="row-hover -mx-2 grid w-[calc(100%+16px)] grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-3 text-left text-[14px] sm:grid-cols-[180px_1fr_120px]"
                  aria-label={`${field.label}: ${missing} listings missing it. Open the list.`}
                >
                  <span className="font-medium text-ink">{field.label}</span>
                  <div className="col-span-2 h-2.5 rounded-sm bg-sunk sm:col-span-1"><div className={`h-2.5 rounded-sm ${pct < 50 ? "bg-crisis" : pct < 80 ? "bg-sand" : "bg-brand"}`} style={{ width: `${pct}%` }} /></div>
                  <span className="tabular text-right text-ink-soft"><span className="font-semibold text-ink">{missing}</span> missing · {pct}% known</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <ListingDrawer filter={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/** Proposed edits from partners, for reviewers (P5). Shows who proposed it, with their email. */
export function ChangeQueue() {
  const { data: changes = [], isPending, isError, refetch } = useQuery({ queryKey: ["partner-changes", "pending"], queryFn: () => fetchResourceChanges("pending"), retry: 1 });
  const [busy, setBusy] = useState<number | null>(null);
  const decide = async (change: ResourceChange, status: "approved" | "rejected") => {
    setBusy(change.id);
    try {
      await reviewResourceChange(change.id, status);
      toast.success(status === "approved" ? "Applied. Young people see it now." : "Declined.");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review that change");
    } finally { setBusy(null); }
  };
  if (isPending) return <p className="mt-4 text-ink-soft">Loading proposed changes…</p>;
  if (isError) return <p className="mt-4 text-crisis">Could not load proposed changes.</p>;
  return (
    <section className="mt-10">
      <h2 className="font-display text-[22px] font-bold text-ink">{changes.length} proposed {changes.length === 1 ? "change" : "changes"} to published listings</h2>
      {changes.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-rule bg-surface p-8 text-center text-[14.5px] text-ink-soft">No proposals waiting. Partners can fill gaps from the &ldquo;Fill the gaps&rdquo; tab; they land here.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {changes.map(change => (
            <li key={change.id} className="rounded-md border border-rule bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-[20px] font-bold text-ink">{change.resourceTitle}</h3>
                <span className="text-stamp">{ago(change.createdAt)}</span>
              </div>
              <p className="text-[13px] text-ink-faint">{change.resourceOrganization} · {change.resourceCounty}</p>
              <p className="mt-2 text-[14px] text-ink-soft">
                Proposed by <span className="font-semibold text-ink">{change.partnerName}</span> · <a href={`mailto:${change.partnerEmail}`} className="text-brand underline underline-offset-2">{change.partnerEmail}</a>
              </p>
              <dl className="mt-3 divide-y divide-rule border-y border-rule text-[14px]">
                {Object.entries(change.changes).map(([field, value]) => {
                  const before = change.current ? (change.current as unknown as Record<string, unknown>)[field] : undefined;
                  const show = (item: unknown) => item === null || item === undefined || item === "" ? "—" : Array.isArray(item) ? item.join(", ") : String(item);
                  return (
                    <div key={field} className="grid gap-1 py-2 sm:grid-cols-[140px_1fr_1fr]">
                      <dt className="font-semibold text-ink-soft">{FIELD_LABEL[field] ?? field}</dt>
                      <dd className="text-ink-faint line-through decoration-ink-faint/60">{show(before)}</dd>
                      <dd className="text-ink">{show(value)}</dd>
                    </div>
                  );
                })}
              </dl>
              {change.note && <p className="mt-3 text-[14px] text-ink-soft">Note: &ldquo;{change.note}&rdquo;</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={busy === change.id} onClick={() => void decide(change, "approved")} className="h-11 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-deep"><Check className="size-4" /> Approve and publish</Button>
                <Button variant="outline" disabled={busy === change.id} onClick={() => void decide(change, "rejected")} className="h-11 rounded-md border-ink px-4 font-semibold text-ink"><X className="size-4" /> Decline</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const FIELD_LABEL: Record<string, string> = {
  title: "Name", organization: "Organization", description: "Description", eligibility: "Who it helps", cost: "Cost",
  applicationSteps: "How to start", whatToBring: "What to bring", website: "Website", phone: "Phone", address: "Address",
  hours: "Hours", languages: "Languages", accessibility: "Accessibility", serviceArea: "Area served", ageMin: "Minimum age",
  ageMax: "Maximum age", fieldsNa: "Confirmed none of", recheckAt: "Re-check by", checkedBy: "Checked by",
};

function Pipe({ label, value }: { label: string; value: number }) {
  return <div><p className="text-eyebrow text-ink-faint">{label}</p><p className="tabular mt-1 font-display text-[28px] font-bold leading-none text-ink">{value}</p></div>;
}

export function SignIn({ onSignedIn, reviewer = false }: { onSignedIn: (partner: PartnerIdentity) => void; reviewer?: boolean }) {
  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();
  const orgId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Partner users create their own account (R11); reviewer accounts are made by Foster Guide.
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // "Forgot your password?" — no mail provider, so a reviewer issues the link (A1).
  const [forgot, setForgot] = useState(false);
  const [forgotNote, setForgotNote] = useState("");
  const ready = creating ? Boolean(email && password && name.trim().length >= 2 && organisation.trim().length >= 2) : Boolean(email && password);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(creating ? await partnerRegister({ name: name.trim(), email, organisation: organisation.trim(), password }) : await partnerLogin(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  };

  if (forgot) {
    const ask = async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true); setError("");
      try { setForgotNote(await requestPasswordReset(email)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send that request"); } finally { setBusy(false); }
    };
    return (
      <form onSubmit={ask} className="max-w-[420px] rounded-md border border-rule bg-surface p-6 sm:p-8">
        <h2 className="font-display text-[26px] font-bold text-ink">Forgot your password?</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">Enter the email you signed up with and we&rsquo;ll get a one-time reset link to that address.</p>
        {forgotNote ? (
          <p role="status" className="mt-5 rounded-md bg-sand-soft px-4 py-3 text-[14px] text-ink">{forgotNote}</p>
        ) : (
          <div className="mt-5">
            <label htmlFor={`${emailId}-forgot`} className="text-[13px] font-semibold text-ink-soft">Work email</label>
            <Input id={`${emailId}-forgot`} type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base" />
            {error && <p role="alert" className="mt-4 rounded-md bg-crisis-soft px-4 py-3 text-[14px] text-crisis">{error}</p>}
            <Button type="submit" disabled={busy || !email} className="mt-5 h-12 w-full rounded-md bg-brand text-base font-semibold text-white hover:bg-brand-deep">{busy ? "Sending" : "Ask for a reset link"}</Button>
          </div>
        )}
        <p className="mt-4 text-[13px] text-ink-faint"><button type="button" onClick={() => { setForgot(false); setError(""); setForgotNote(""); }} className="font-semibold text-brand hover:underline">Back to sign in</button></p>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-[420px] rounded-md border border-rule bg-surface p-6 sm:p-8">
      <h2 className="font-display text-[26px] font-bold text-ink">{reviewer ? "Reviewer sign-in" : creating ? "Create a partner account" : "Sign in"}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
        {reviewer ? "Reviewer accounts approve listings and changes. Contributor accounts work here too." : creating ? "Takes a minute. Everything you add or change waits for a reviewer before young people see it." : "Sign in to submit resources, fill gaps, and use the staff guide."}
      </p>

      <div className="mt-5 space-y-4">
        {creating && (
          <>
            <div>
              <label htmlFor={nameId} className="text-[13px] font-semibold text-ink-soft">Your name</label>
              <Input id={nameId} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base" />
            </div>
            <div>
              <label htmlFor={orgId} className="text-[13px] font-semibold text-ink-soft">Organization or program</label>
              <Input id={orgId} autoComplete="organization" value={organisation} onChange={event => setOrganisation(event.target.value)} placeholder="e.g. Alameda County ILP" className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base" />
            </div>
          </>
        )}
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
          <div className="flex items-baseline justify-between">
            <label htmlFor={passwordId} className="text-[13px] font-semibold text-ink-soft">Password</label>
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} className="inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
              {showPassword ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}{showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete={creating ? "new-password" : "current-password"}
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base"
          />
          {!creating && <button type="button" onClick={() => { setForgot(true); setError(""); }} className="mt-2 text-[13px] text-brand hover:underline">Forgot your password?</button>}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md bg-crisis-soft px-4 py-3 text-[14px] text-crisis">{error}</p>}

      <Button
        type="submit"
        disabled={busy || !ready}
        className="mt-5 h-12 w-full rounded-md bg-brand text-base font-semibold text-white hover:bg-brand-deep"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? (creating ? "Creating your account" : "Signing in") : creating ? "Create account" : "Sign in"}
      </Button>

      {reviewer ? (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">Reviewer accounts are created by Foster Guide. Contact the team if you should have one.</p>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
          {creating ? "Already have an account? " : "New here? "}
          <button type="button" onClick={() => { setCreating(value => !value); setError(""); }} className="font-semibold text-brand hover:underline">{creating ? "Sign in instead" : "Create a partner account"}</button>
          {creating && <span className="mt-1 block">Passwords need at least 12 characters.</span>}
        </p>
      )}
    </form>
  );
}

export function Queue({ reviewer }: { reviewer: PartnerIdentity }) {
  const { data: submissions = [], isPending, isError, refetch } = useQuery({
    queryKey: ["partner-submissions", reviewer.email],
    queryFn: fetchSubmissions,
    retry: 1,
  });
  // Youth reports belong in the queue too: they are work waiting on a reviewer.
  const analytics = useQuery({ queryKey: ["partner-analytics"], queryFn: fetchPartnerAnalytics, retry: 1 });
  const reports = analytics.data?.reports ?? [];
  const [drawer, setDrawer] = useState<DrawerFilter | null>(null);

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
        {pending.length + reports.length} waiting on you
      </h2>
      <p className="mt-1 text-[14px] text-ink-faint">{pending.length} new {pending.length === 1 ? "listing" : "listings"} · {reports.length} {reports.length === 1 ? "report" : "reports"} from young people · proposed edits below</p>

      <section className="mt-8">
        <h3 className="font-display text-[20px] font-bold text-ink">Flagged by young people</h3>
        <ReportsPanel reports={reports} reviewer onOpen={report => setDrawer({ title: report.title, detail: `Youth report: “${report.reason}”`, resourceId: report.resource_id })} />
      </section>

      <h3 className="mt-10 font-display text-[20px] font-bold text-ink">New listings</h3>

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

      <ChangeQueue />
      <ListingDrawer filter={drawer} onClose={() => setDrawer(null)} />

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
              Program page <ExternalLink className="size-3.5" />
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
