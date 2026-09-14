import { useId, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitResource, submitPartnerResource } from "@/lib/api";

const categories = [
  "Housing", "Education", "Scholarships", "Employment", "Financial Support", "Healthcare",
  "Mental Health", "Legal Support", "Food Assistance", "Clothing Assistance", "Transportation",
  "Community Support", "Life Skills and Mentoring", "Technology", "Other",
]; // must match data/build_resources.py's canonical category list (see ResourcesPage.tsx)
const counties = ["Alameda", "Contra Costa", "Bay Area", "California", "National"];
const EMPTY = { title: "", organization: "", description: "", category: "", county: "", website: "", contact: "", sourceUrl: "", relationship: "", submitterName: "" };

/**
 * Share a resource. Used on the youth side (/add-resource, anonymous) and the
 * partner side (partnerMode, tied to the signed-in account).
 */
export function AddResourcePage({ partnerMode = false }: { partnerMode?: boolean }) {
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const valid = form.title.length >= 3 && form.organization.length >= 2 && form.description.length >= 20 && form.category && form.county && form.website && form.sourceUrl && form.relationship.length >= 5;
  const submit = async () => {
    setPending(true); setError("");
    try { await (partnerMode ? submitPartnerResource(form) : submitResource(form)); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not submit"); }
    finally { setPending(false); }
  };

  const body = done ? (
    <div className="rounded-md border border-rule bg-surface p-8">
      <CheckCircle2 className="size-8 text-brand" />
      <h2 className="mt-3 font-display text-[24px] font-bold text-ink">Submitted for review</h2>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-soft">It&rsquo;s in the review queue. It won&rsquo;t show up in search or in Maya&rsquo;s answers until a person has checked it.</p>
      <Button onClick={() => { setDone(false); setForm(EMPTY); }} className="mt-5 h-11 rounded-md border border-ink bg-transparent px-4 font-semibold text-ink hover:bg-sand-soft">Submit another</Button>
    </div>
  ) : (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
      <form onSubmit={event => { event.preventDefault(); void submit(); }} className="grid gap-5 rounded-md border border-rule bg-surface p-6 sm:grid-cols-2 sm:p-7">
        <Field label="Program name" value={form.title} set={v => update("title", v)} wide />
        <Field label="Organization" value={form.organization} set={v => update("organization", v)} wide />
        <TextField label="What does it offer, and who is it for?" hint="Plain words. What a 19-year-old gets, and who can get it." value={form.description} onChange={v => update("description", v)} minHeight="min-h-28" wide />
        <SelectField label="Kind of support" value={form.category} set={v => update("category", v)} options={categories} />
        <SelectField label="County or region" value={form.county} set={v => update("county", v)} options={counties} />
        <Field label="Program website" value={form.website} set={v => update("website", v)} type="url" placeholder="https://" />
        <Field label="Official page you used to verify details" value={form.sourceUrl} set={v => update("sourceUrl", v)} type="url" placeholder="https://" />
        <Field label="Phone or contact (optional)" value={form.contact} set={v => update("contact", v)} />
        <Field label={partnerMode ? "Your name (as it should appear to reviewers)" : "Your name (optional — anonymous is okay)"} value={form.submitterName} set={v => update("submitterName", v)} />
        <TextField label="How do you know about this resource?" value={form.relationship} onChange={v => update("relationship", v)} minHeight="min-h-20" placeholder="I work there, I used it, I found it through…" wide />
        {error && <p className="rounded-md bg-crisis-soft px-4 py-3 text-[14px] text-crisis sm:col-span-2">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <span className="text-[13px] text-ink-faint">A reviewer checks every field before it goes live.</span>
          <Button type="submit" disabled={!valid || pending} className="h-12 rounded-md bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </form>
      <aside className="rounded-md bg-sand-soft p-6">
        <h2 className="font-display text-[20px] font-bold text-ink">What reviewers look for</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-ink-soft">
          <li>The source is the program&rsquo;s own page, not a directory.</li>
          <li>Eligibility says who can get it — ages, care status.</li>
          <li>Cost is stated, even if it&rsquo;s &ldquo;ask them&rdquo;.</li>
          <li>Steps a young person can actually follow.</li>
        </ul>
        <p className="mt-4 border-t border-rule pt-3 text-[13px] text-ink-faint">Don&rsquo;t include a young person&rsquo;s name, case details or private records.</p>
      </aside>
    </div>
  );

  if (partnerMode) return body;
  return (
    <div className="container-wide pt-8 lg:pt-12">
      <p className="text-eyebrow text-brand">Help us fill a gap</p>
      <h1 className="mt-2 text-display text-ink">Share a resource</h1>
      <p className="mt-2 max-w-[64ch] text-[16px] leading-relaxed text-ink-soft">Nothing you send goes live on its own. A person checks the source, who qualifies, and the contact details before any young person sees it.</p>
      <div className="mt-8">{body}</div>
    </div>
  );
}

const inputClass = "mt-1.5 h-12 rounded-md border-rule bg-surface text-base";

function Field({ label, value, set, type = "text", placeholder, wide }: { label: string; value: string; set: (value: string) => void; type?: string; placeholder?: string; wide?: boolean }) {
  const id = useId();
  return <div className={wide ? "sm:col-span-2" : undefined}><Label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">{label}</Label><Input id={id} type={type} placeholder={placeholder} className={inputClass} value={value} onChange={e => set(e.target.value)} /></div>;
}
function SelectField({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: string[] }) {
  const id = useId();
  return <div><Label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">{label}</Label><Select value={value} onValueChange={set}><SelectTrigger id={id} className={`${inputClass} w-full`}><SelectValue placeholder="Choose one" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
function TextField({ label, hint, value, onChange, minHeight, placeholder, wide }: { label: string; hint?: string; value: string; onChange: (value: string) => void; minHeight: string; placeholder?: string; wide?: boolean }) {
  const id = useId();
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">{label}</Label>
      {hint && <p className="mt-0.5 text-[12px] text-ink-faint">{hint}</p>}
      <Textarea id={id} className={`mt-1.5 ${minHeight} rounded-md border-rule bg-surface text-base`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
