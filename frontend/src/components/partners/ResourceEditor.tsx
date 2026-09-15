import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePartner } from "@/contexts/PartnerContext";
import { NA_FIELDS, proposeResourceChange, type MissingField, type ResourceChanges, type ResourceItem } from "@/lib/api";
import { describeChecked } from "@/lib/checked";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NA_LABEL: Record<MissingField, string> = {
  phone: "No phone line",
  website: "No website",
  hours: "No set hours (online / by appointment)",
  address: "No walk-in address",
  languages: "English only",
  cost: "Cost genuinely varies / not applicable",
  age: "No age limit",
};

const TEXT_FIELDS: { key: keyof ResourceChanges; label: string; long?: boolean; na?: MissingField }[] = [
  { key: "description", label: "What it offers, in plain words", long: true },
  { key: "eligibility", label: "Who it helps" },
  { key: "applicationSteps", label: "How to start", long: true },
  { key: "whatToBring", label: "What to bring" },
  { key: "cost", label: "Cost", na: "cost" },
  { key: "phone", label: "Phone", na: "phone" },
  { key: "website", label: "Website", na: "website" },
  { key: "hours", label: "Hours", na: "hours" },
  { key: "address", label: "Address", na: "address" },
  { key: "languages", label: "Languages", na: "languages" },
  { key: "accessibility", label: "Accessibility" },
  { key: "serviceArea", label: "Area served" },
];

/**
 * Edit a published listing (P6). Contributors file a proposal that a reviewer
 * approves; reviewers apply directly. Each contact field can be marked
 * "confirmed: none" so a blank stops reading as "unknown" (P7), and a listing
 * can carry a re-check date (P7).
 *
 * `focus` opens with one field highlighted — the gap someone came to fill.
 */
export function ResourceEditor({ resource, focus, onSaved, onCancel }: {
  resource: ResourceItem;
  focus?: MissingField;
  onSaved?: (result: { status: "pending" | "approved"; resource?: ResourceItem }) => void;
  onCancel?: () => void;
}) {
  const { partner } = usePartner();
  const reviewer = partner?.role === "reviewer";
  const queryClient = useQueryClient();
  const id = useId();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(TEXT_FIELDS.map(field => [field.key, String(resource[field.key as keyof ResourceItem] ?? "")])));
  const [ageMin, setAgeMin] = useState(resource.ageMin?.toString() ?? "");
  const [ageMax, setAgeMax] = useState(resource.ageMax?.toString() ?? "");
  const [na, setNa] = useState<Set<MissingField>>(new Set((resource.fieldsNa ?? []) as MissingField[]));
  const [recheckAt, setRecheckAt] = useState(resource.recheckAt ?? "");
  const [checkedBy, setCheckedBy] = useState<"online" | "phone">("online");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const checked = describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt);

  const toggleNa = (field: MissingField) => setNa(previous => {
    const next = new Set(previous);
    if (next.has(field)) next.delete(field); else next.add(field);
    return next;
  });

  /** Only what actually changed goes to the server, so a proposal reads as a small diff. */
  const changes = (): ResourceChanges => {
    const out: ResourceChanges = {};
    for (const field of TEXT_FIELDS) {
      const before = String(resource[field.key as keyof ResourceItem] ?? "");
      if (draft[field.key] !== before) (out as Record<string, string>)[field.key] = draft[field.key];
    }
    const min = ageMin === "" ? null : Number(ageMin);
    const max = ageMax === "" ? null : Number(ageMax);
    if (min !== (resource.ageMin ?? null)) out.ageMin = min;
    if (max !== (resource.ageMax ?? null)) out.ageMax = max;
    const naNow = [...na].sort().join(",");
    const naBefore = [...(resource.fieldsNa ?? [])].sort().join(",");
    if (naNow !== naBefore) out.fieldsNa = [...na];
    if ((recheckAt || null) !== (resource.recheckAt ?? null)) out.recheckAt = recheckAt || null;
    if (reviewer && checkedBy === "phone") out.checkedBy = "phone";
    return out;
  };
  const pending = changes();
  const hasChanges = Object.keys(pending).some(key => key !== "checkedBy");

  const submit = async () => {
    setBusy(true);
    try {
      const result = await proposeResourceChange(resource.id, pending, note);
      await queryClient.invalidateQueries({ queryKey: ["partner-analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["partner-resources"] });
      await queryClient.invalidateQueries({ queryKey: ["partner-changes"] });
      toast.success(result.status === "approved" ? "Saved. Young people see this now." : "Sent to a reviewer. Thank you — it shows once they approve it.");
      onSaved?.(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that change");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="flex flex-col gap-5">
      <div>
        <p className="text-eyebrow text-brand">{reviewer ? "Edit · applies immediately" : "Propose a change · a reviewer approves it"}</p>
        <h2 className="mt-1 font-display text-[24px] font-bold leading-tight text-ink">{resource.title}</h2>
        <p className="text-[13px] text-ink-faint">{resource.organization} · {resource.category} · {resource.county} · <span className={cn(checked.stale && "text-crisis")}>{checked.label}</span></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map(field => {
          const isNa = field.na ? na.has(field.na) : false;
          const highlighted = focus && field.na === focus;
          return (
            <div key={field.key} className={cn(field.long && "sm:col-span-2", highlighted && "rounded-md bg-brand-soft/50 p-3 -m-3")}>
              <label htmlFor={`${id}-${field.key}`} className="text-[13px] font-semibold text-ink-soft">{field.label}</label>
              {field.long ? (
                <Textarea id={`${id}-${field.key}`} value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} disabled={isNa} className="mt-1.5 min-h-24 rounded-md border-rule bg-surface text-[15px]" />
              ) : (
                <Input id={`${id}-${field.key}`} value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} disabled={isNa} placeholder={isNa ? "Confirmed: none" : undefined} className="mt-1.5 h-11 rounded-md border-rule bg-surface text-[15px]" />
              )}
              {field.na && (
                <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-faint">
                  <input type="checkbox" checked={isNa} onChange={() => toggleNa(field.na!)} className="size-3.5 accent-[var(--brand)]" />
                  {NA_LABEL[field.na]} — confirmed with the program
                </label>
              )}
            </div>
          );
        })}
        <div className={cn(focus === "age" && "rounded-md bg-brand-soft/50 p-3 -m-3")}>
          <span className="text-[13px] font-semibold text-ink-soft">Ages</span>
          <div className="mt-1.5 flex items-center gap-2">
            <Input aria-label="Minimum age" type="number" min={0} max={120} value={ageMin} onChange={event => setAgeMin(event.target.value)} disabled={na.has("age")} className="h-11 w-24 rounded-md border-rule bg-surface text-[15px]" />
            <span className="text-ink-faint">to</span>
            <Input aria-label="Maximum age" type="number" min={0} max={120} value={ageMax} onChange={event => setAgeMax(event.target.value)} disabled={na.has("age")} className="h-11 w-24 rounded-md border-rule bg-surface text-[15px]" />
          </div>
          <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-faint">
            <input type="checkbox" checked={na.has("age")} onChange={() => toggleNa("age")} className="size-3.5 accent-[var(--brand)]" />
            {NA_LABEL.age} — confirmed with the program
          </label>
        </div>
        <div>
          <label htmlFor={`${id}-recheck`} className="text-[13px] font-semibold text-ink-soft">Check again by <span className="font-normal text-ink-faint">(optional — e.g. a summer scholarship)</span></label>
          <Input id={`${id}-recheck`} type="date" value={recheckAt} onChange={event => setRecheckAt(event.target.value)} className="mt-1.5 h-11 rounded-md border-rule bg-surface text-[15px]" />
        </div>
      </div>

      {reviewer && (
        <fieldset className="rounded-md border border-rule p-4">
          <legend className="px-1 text-[13px] font-semibold text-ink-soft">How did you check this?</legend>
          <div className="flex flex-wrap gap-4 text-[14px]">
            {(["online", "phone"] as const).map(option => (
              <label key={option} className="inline-flex cursor-pointer items-center gap-2">
                <input type="radio" name={`${id}-checkedBy`} checked={checkedBy === option} onChange={() => setCheckedBy(option)} className="accent-[var(--brand)]" />
                {option === "online" ? "Against the program's page" : "By phone with the program"}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">Saving records today as the check date under your account.</p>
        </fieldset>
      )}

      <div>
        <label htmlFor={`${id}-note`} className="text-[13px] font-semibold text-ink-soft">{reviewer ? "Note for the audit record" : "Note for the reviewer"} <span className="font-normal text-ink-faint">(optional)</span></label>
        <Textarea id={`${id}-note`} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} placeholder={reviewer ? "e.g. Called 9/15, intake line confirmed no walk-ins" : "e.g. I work here; our new number since August"} className="mt-1.5 min-h-16 rounded-md border-rule bg-surface text-[15px]" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !hasChanges} className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {reviewer ? "Save and publish" : "Send for review"}
        </Button>
        {onCancel && <button type="button" onClick={onCancel} className="text-[14px] text-ink-soft hover:text-ink">Cancel</button>}
        {!hasChanges && <span className="text-[13px] text-ink-faint">Nothing changed yet.</span>}
      </div>
    </form>
  );
}

export { NA_FIELDS };
