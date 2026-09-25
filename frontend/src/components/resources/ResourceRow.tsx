import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, ExternalLink, Link2, MessageSquare, Phone, ShieldCheck, X } from "lucide-react";
import { BottomSheet } from "@/components/primitives/BottomSheet";
import { AddToPlanButton } from "@/components/resources/AddToPlanButton";
import { ReportSheet } from "@/components/resources/ReportSheet";
import { Button } from "@/components/ui/button";
import { useSavedResources } from "@/hooks/useSavedResources";
import { reportResource, type ResourceItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { describeChecked } from "@/lib/checked";
import { contactActions, smsHref, type ContactActions } from "@/lib/contactActions";
import { toast } from "sonner";

/**
 * ResourceRow — one listing in a ruled list.
 *
 * Title and checked-date on the first line, organisation, a plain sentence,
 * then small tags for who it's for, where, how, and cost. Tap the row for
 * detail; Save is its own focusable button.
 */
/** The query parameter that names an open listing, so a listing has a URL (audit A18). */
export const LISTING_PARAM = "listing";

export function ResourceRow({ resource, dense = false }: { resource: ResourceItem; dense?: boolean }) {
  // Open state lives in the URL: Back closes the sheet, and the address can be shared.
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const setOpen = (next: boolean) => {
    const following = new URLSearchParams(params);
    if (next) { queryClient.setQueryData(["resource", resource.id], resource); following.set(LISTING_PARAM, String(resource.id)); }
    else following.delete(LISTING_PARAM);
    setParams(following, { replace: !next });
  };
  const { isSaved, toggleSave } = useSavedResources();
  const saved = isSaved(resource.id);
  const checked = describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt);

  return (
    <>
      <div className={cn("row-hover -mx-2 grid grid-cols-[1fr_auto] items-start gap-3 rounded-md px-2 lg:gap-6", dense ? "py-3.5" : "py-4 lg:py-5")}>
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h3 className="font-sans text-[16px] font-semibold leading-snug text-ink lg:text-[17px]">{resource.title}</h3>
            <span className={cn("text-stamp", checked.stale && "text-crisis")}>{checked.label}</span>
          </div>
          {differentOrganisation(resource) && <p className="mt-0.5 text-[13px] text-ink-faint lg:text-[14px]">{resource.organization}</p>}
          {!dense && <p className="mt-1.5 line-clamp-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-soft lg:text-[15px]">{resource.description}</p>}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {eligibilityTag(resource) && <Tag tone="teal">{eligibilityTag(resource)}</Tag>}
            <Tag>{resource.county}</Tag>
            {resource.kind === "information" ? <Tag tone="sand">Guide</Tag> : !dense && showDelivery(resource.deliveryMode) && <Tag>{resource.deliveryMode}</Tag>}
            {resource.kind !== "information" && <CostTag cost={resource.cost} />}
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleSave(resource.id)}
          aria-label={saved ? `Remove ${resource.title} from saved` : `Save ${resource.title}`}
          aria-pressed={saved}
          className={cn(
            "flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-[14px] font-semibold text-ink transition-colors lg:px-3",
            saved ? "border-ink bg-sand-soft" : "border-rule bg-surface hover:border-ink",
          )}
        >
          <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
          <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
        </button>
      </div>
    </>
  );
}

export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "teal" | "green" | "sand" | "rust" }) {
  const tones = {
    plain: "border border-rule bg-ground text-ink-soft",
    teal: "bg-brand-soft text-ink",
    green: "bg-green-soft text-green",
    sand: "bg-sand-soft text-ink-soft",
    rust: "bg-crisis-soft text-crisis",
  };
  return <span className={cn("inline-flex h-6 items-center rounded px-2 text-[12px] font-semibold", tones[tone])}>{children}</span>;
}

function CostTag({ cost }: { cost: string }) {
  const c = (cost || "").trim();
  if (/^free\b/i.test(c) && !/sliding|consult/i.test(c)) return <Tag tone="green">Free</Tag>;
  if (!c || /not confirmed|ask/i.test(c)) return <Tag tone="sand">Cost: ask them</Tag>;
  return <Tag tone="sand">{c.length > 28 ? "Cost: see details" : c}</Tag>;
}

function eligibilityTag(resource: ResourceItem) {
  const { ageMin, ageMax } = resource;
  if (ageMin !== null && ageMax !== null) return `Ages ${ageMin}–${ageMax}`;
  if (ageMin !== null) return `Ages ${ageMin}+`;
  if (ageMax !== null) return `Under ${ageMax + 1}`;
  return null;
}

/**
 * "Online" was inferred by the importer from the presence of a website (audit
 * A13), so a shelter could read "Online". Only show a mode a person set or a
 * stronger signal produced; reviewers can set it in the editor.
 */
function showDelivery(mode: string) {
  return mode === "In person" || mode === "Phone or text";
}

export function ResourceDetailSheet({ resource, open, onOpenChange }: { resource: ResourceItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/resources?${LISTING_PARAM}=${resource.id}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied. It opens this listing directly."); }
    catch { toast.error("Could not copy. The address bar has the same link."); }
  };
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const checked = describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt);
  const { isSaved, toggleSave } = useSavedResources();
  const saved = isSaved(resource.id);
  const contact = contactActions(resource.phone);
  const guide = resource.kind === "information";
  const na = new Set(resource.fieldsNa ?? []);

  const submitReport = async () => {
    try {
      await reportResource(resource.id, reportReason);
      setReporting(false);
      setReportReason("");
      toast.success("Sent to a partner for review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that report. Try again.");
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={resource.title}>
      <div className="flex items-center justify-between border-b border-rule px-5 py-3 lg:px-8">
        <button type="button" onClick={() => onOpenChange(false)} className="inline-flex min-h-10 items-center gap-1.5 text-[14px] text-brand hover:underline">
          <ArrowLeft className="size-4" /> Back to results
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[14px] text-ink-soft hover:bg-sunk hover:text-ink"><Link2 className="size-4" /> Copy link</button>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex size-11 items-center justify-center rounded-md text-ink-faint hover:bg-sunk">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 pb-28 pt-6 lg:px-8 lg:pb-10">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="teal">{resource.category}</Tag>
            <Tag>{resource.county}</Tag>
            {guide ? <Tag tone="sand">Guide</Tag> : <CostTag cost={resource.cost} />}
            {resource.urgencyLevel === "Emergency" && <Tag tone="rust">Emergency</Tag>}
          </div>
          <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-ink lg:text-[30px]">{resource.title}</h2>
          {differentOrganisation(resource) && <p className="mt-1 text-[15px] text-ink-faint">{resource.organization}</p>}
        </div>

        <div className="hidden flex-wrap gap-2.5 lg:flex">
          <Actions contact={guide ? {} : contact} website={resource.website} guide={guide} phoneNone={na.has("phone")} saved={saved} onSave={() => toggleSave(resource.id)} />
          {!guide && <AddToPlanButton resource={resource} />}
        </div>

        <p className="text-[16px] leading-relaxed text-ink-soft">{resource.description}</p>

        {guide ? (
          // A guide has nothing to call or visit, so no empty "Hours: not confirmed" headings (Y11).
          <div className="grid gap-5 border-t border-rule pt-6 sm:grid-cols-2 sm:gap-x-8">
            {resource.eligibility && <Detail title="Who it's for" text={resource.eligibility} />}
            {resource.applicationSteps && <Detail title="How to use it" text={resource.applicationSteps} />}
            {resource.serviceArea && <Detail title="Area it covers" text={resource.serviceArea} />}
          </div>
        ) : (
          <div className="grid gap-5 border-t border-rule pt-6 sm:grid-cols-2 sm:gap-x-8">
            <Detail title="Who it helps" text={resource.eligibility} />
            <Detail title="How to start" text={resource.applicationSteps} />
            <Detail title="What to bring" text={resource.whatToBring} />
            <Detail title="Hours" text={resource.hours} none={na.has("hours") ? "No set hours — confirmed with the program" : undefined} />
            <Detail title="Languages" text={resource.languages} none={na.has("languages") ? "English only — confirmed" : undefined} />
            <Detail title="Accessibility" text={resource.accessibility} />
            {(resource.address || na.has("address")) && <Detail title="Address" text={resource.address} none={na.has("address") ? "No walk-in address — confirmed" : undefined} />}
            {resource.serviceArea && <Detail title="Area served" text={resource.serviceArea} />}
          </div>
        )}

        <div className="border-t border-rule pt-5 text-[13px] leading-relaxed text-ink-faint">
          <p className="flex items-start gap-2 text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">{checked.stale ? "Needs a re-check" : `Checked ${checked.how} ${checked.full}`}</span>
              {" "}by a Foster Guide reviewer{checked.how === "online" ? " against the program's own page, not by calling" : ""}.
            </span>
          </p>
          {resource.sourceUrl && (
            <p className="mt-1.5">
              Source:{" "}
              <a href={resource.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-brand underline underline-offset-2">{hostOf(resource.sourceUrl)}</a>.
              {" "}Programs change. Always confirm with them before you go.
            </p>
          )}
          <button type="button" onClick={() => setReporting(true)} className="mt-3 text-brand hover:underline">
            Something here is wrong or out of date? Tell us.
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex gap-2.5 border-t border-rule bg-surface px-5 pb-6 pt-3 lg:hidden">
        <Actions contact={guide ? {} : contact} website={resource.website} guide={guide} phoneNone={na.has("phone")} saved={saved} onSave={() => toggleSave(resource.id)} compact />
        {!guide && <AddToPlanButton resource={resource} compact />}
      </div>

      {reporting && <ReportSheet reason={reportReason} setReason={setReportReason} onCancel={() => setReporting(false)} onSubmit={submitReport} />}
    </BottomSheet>
  );
}

/**
 * Call and Text are separate real links (audit A01): a text-only line gets an
 * sms: link carrying its keyword, never a tel: to a short code.
 */
function Actions({ contact, website, guide = false, phoneNone = false, saved, onSave, compact = false }: {
  contact: ContactActions; website?: string; guide?: boolean; phoneNone?: boolean; saved: boolean; onSave: () => void; compact?: boolean;
}) {
  const primary = cn("h-12 rounded-md bg-brand px-5 text-[16px] font-semibold text-white hover:bg-brand-deep", compact && "flex-1");
  return (
    <>
      {guide && website ? (
        <Button asChild className={primary}>
          <a href={website} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open the guide</a>
        </Button>
      ) : contact.call || contact.text ? (
        <>
          {contact.call && (
            <Button asChild className={primary}>
              <a href={`tel:${contact.call.number}`}><Phone className="size-4" />{compact ? "Call" : contact.call.label}</a>
            </Button>
          )}
          {contact.text && (
            <Button asChild className={contact.call ? cn("h-12 rounded-md border-ink px-4 text-[15px] font-semibold text-ink", compact && "flex-1") : primary} variant={contact.call ? "outline" : "default"}>
              <a href={smsHref(contact.text.number, contact.text.keyword)}><MessageSquare className="size-4" />{compact ? (contact.text.keyword ? `Text ${contact.text.keyword}` : "Text") : contact.text.label}</a>
            </Button>
          )}
        </>
      ) : compact && !guide ? (
        <span className="flex flex-1 items-center text-[13px] text-ink-faint">{phoneNone ? "No phone line — confirmed" : "No phone listed"}</span>
      ) : null}
      {website && !guide && (
        <Button asChild variant="outline" className={cn("h-12 rounded-md border-ink px-4 text-[15px] font-semibold text-ink", compact && "w-12 px-0")}>
          <a href={website} target="_blank" rel="noreferrer" aria-label="Website"><ExternalLink className="size-4" />{!compact && "Website"}</a>
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onSave}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save this resource"}
        className={cn("h-12 rounded-md border-ink px-4 text-[15px] font-semibold text-ink", saved && "bg-sand-soft", compact && "w-12 px-0")}
      >
        <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
        {!compact && (saved ? "Saved" : "Save")}
      </Button>
    </>
  );
}

/** Most listings are named after their organisation; printing it twice is noise. */
function differentOrganisation(resource: ResourceItem) {
  const norm = (value: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const org = norm(resource.organization);
  return Boolean(org) && org !== norm(resource.title);
}

function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

/** `none` says a reviewer confirmed the listing has no such thing, which is different from "we don't know yet" (P7). */
function Detail({ title, text, none }: { title: string; text?: string; none?: string }) {
  const unknown = !text || !text.trim();
  return (
    <div>
      <p className="text-eyebrow text-ink-faint">{title}</p>
      <p className={cn("mt-1.5 whitespace-pre-line text-[15px] leading-relaxed", unknown && !none ? "italic text-ink-stamp" : "text-ink-soft")}>
        {unknown ? (none ?? "Not confirmed yet — ask them") : text}
      </p>
    </div>
  );
}

