import { useId, useState } from "react";
import { CheckCircle2, HeartHandshake, Loader2, SearchCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export function AddResourcePage({ partnerMode = false }: { partnerMode?: boolean }) {
  const [form, setForm] = useState({ title: "", organization: "", description: "", category: "", county: "", website: "", contact: "", sourceUrl: "", relationship: "", submitterName: "" });
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const valid = form.title.length >= 3 && form.organization.length >= 2 && form.description.length >= 20 && form.category && form.county && form.website && form.sourceUrl && form.relationship.length >= 5;
  const submit = async () => { setPending(true); setError(""); try { await (partnerMode ? submitPartnerResource(form) : submitResource(form)); setDone(true); } catch (e) { setError(e instanceof Error ? e.message : "Could not submit"); } finally { setPending(false); } };

  return <div className="mx-auto w-full px-5 lg:px-10 max-w-[820px] py-10 lg:py-14"><div className="mb-8"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand"><HeartHandshake className="size-4" />Help us fill a gap</div><h1 className="text-display-sm mt-2 text-ink">Share a resource</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">Nothing you send goes live on its own. A person checks the source, who qualifies, and the contact details before any young person sees it.</p></div>{done ? <Card className="rounded-3xl border-brand/25 bg-brand-soft"><CardContent className="p-10 text-center"><CheckCircle2 className="mx-auto size-10 text-brand" /><h2 className="mt-4 text-xl font-bold text-ink">Submitted for verification</h2><p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">It’s in the review queue. It won’t show up in search or in Maya’s answers until someone has checked it.</p><Button onClick={() => { setDone(false); setForm({ title: "", organization: "", description: "", category: "", county: "", website: "", contact: "", sourceUrl: "", relationship: "", submitterName: "" }); }} className="mt-5">Submit another</Button></CardContent></Card> : <Card className="rounded-3xl border-rule"><CardContent className="space-y-5 p-6 sm:p-8"><div className="rounded-2xl border border-brand/20 bg-brand-soft p-4 text-xs leading-relaxed text-ink-soft"><SearchCheck className="mr-2 inline size-4" />Link the programme’s own page as the source. Telling us how you know about it helps, but we still verify it ourselves.</div><Field label="Program name" value={form.title} set={v => update("title", v)} /><Field label="Organization" value={form.organization} set={v => update("organization", v)} /><TextField label="What does it offer and who is it for?" value={form.description} onChange={v => update("description", v)} minHeight="min-h-28" /><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Category" value={form.category} set={v => update("category", v)} options={categories} /><SelectField label="County or region" value={form.county} set={v => update("county", v)} options={counties} /></div><Field label="Program website" value={form.website} set={v => update("website", v)} type="url" /><Field label="Official page used to verify details" value={form.sourceUrl} set={v => update("sourceUrl", v)} type="url" /><Field label="Contact information (optional)" value={form.contact} set={v => update("contact", v)} /><TextField label="How do you know about this resource?" value={form.relationship} onChange={v => update("relationship", v)} minHeight="min-h-20" placeholder="For example: I used it, I work there, or I found it through..." /><Field label="Your name (optional—anonymous is okay)" value={form.submitterName} set={v => update("submitterName", v)} />{error && <p className="rounded-xl bg-crisis-soft p-3 text-sm text-crisis">{error}</p>}<Button disabled={!valid || pending} onClick={submit} className="h-12 w-full rounded-xl bg-brand">{pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{pending ? "Submitting..." : "Submit for verification"}</Button></CardContent></Card>}</div>;
}

function Field({ label, value, set, type = "text" }: { label: string; value: string; set: (value: string) => void; type?: string }) {
  const id = useId();
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} type={type} className="mt-2 h-12 rounded-xl" value={value} onChange={e => set(e.target.value)} /></div>;
}
function SelectField({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: string[] }) {
  const id = useId();
  return <div><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={set}><SelectTrigger id={id} className="mt-2 h-12 rounded-xl"><SelectValue placeholder="Choose one" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
function TextField({ label, value, onChange, minHeight, placeholder }: { label: string; value: string; onChange: (value: string) => void; minHeight: string; placeholder?: string }) {
  const id = useId();
  return <div><Label htmlFor={id}>{label}</Label><Textarea id={id} className={`mt-2 ${minHeight} rounded-xl`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>;
}
