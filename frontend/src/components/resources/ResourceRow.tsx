import { useId, useState } from "react";
import { Bookmark, ExternalLink, Phone, ShieldCheck } from "lucide-react";
import { BottomSheet } from "@/components/primitives/BottomSheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSavedResources } from "@/hooks/useSavedResources";
import { reportResource, type ResourceItem } from "@/lib/api";
import { toast } from "sonner";

/**
 * ResourceRow — replaces the ResourceCard grid.
 *
 * A divided list, not a grid of cards: faster to scan on a phone, and it
 * fits far more results above the fold. The whole row is the tap target;
 * the bookmark is a separately-focusable nested button.
 */
export function ResourceRow({ resource }: { resource: ResourceItem }) {
  const [open, setOpen] = useState(false);
  const { isSaved, toggleSave } = useSavedResources();
  const saved = isSaved(resource.id);
  const verifiedDate = formatVerifiedDate(resource.verifiedAt);

  return (
    <>
      <div className="flex items-stretch gap-2 border-b border-rule-soft last:border-b-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 py-4 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-base font-semibold leading-snug text-ink">{resource.title}</h3>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-faint">{resource.organization}</p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{resource.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-faint">
            <span>{resource.county}</span>
            <Dot />
            <span>{resource.deliveryMode || "Ask directly"}</span>
            <Dot />
            <span>Checked {verifiedDate}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleSave(resource.id)}
          aria-label={saved ? `Remove ${resource.title} from saved` : `Save ${resource.title}`}
          aria-pressed={saved}
          className="flex size-11 shrink-0 items-center justify-center self-center rounded-full text-ink-faint hover:bg-brand-soft hover:text-brand"
        >
          <Bookmark className="size-4.5" fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <ResourceDetailSheet resource={resource} open={open} onOpenChange={setOpen} />
    </>
  );
}

function Dot() {
  return <span aria-hidden className="text-ink-faint">&middot;</span>;
}

function formatVerifiedDate(verifiedAt: string) {
  const date = new Date(`${verifiedAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * ResourceDetail — a bottom sheet, not a dialog.
 *
 * Content order: Call/Website pinned at the bottom as the two things a
 * person actually needs, then who may qualify, how to start, what to
 * bring, then the practical details. Every field handles empty gracefully.
 */
function ResourceDetailSheet({
  resource,
  open,
  onOpenChange,
}: {
  resource: ResourceItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const verifiedDate = formatVerifiedDate(resource.verifiedAt);
  const { isSaved, toggleSave } = useSavedResources();
  const saved = isSaved(resource.id);
  const phone = resource.phone?.replace(/[^\d+]/g, "");

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
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:px-7">
          <div className="mb-1 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">{resource.category}</span>
            <span className="rounded-full bg-sunk px-2.5 py-1 font-medium text-ink-soft">{resource.county}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{resource.title}</h2>
          <p className="text-sm text-ink-faint">{resource.organization}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{resource.description}</p>

          <div className="mt-5 space-y-4 text-sm">
            <Detail title="Who may qualify" text={resource.eligibility} />
            <Detail title="How to start" text={resource.applicationSteps} />
            <Detail title="What to bring" text={resource.whatToBring} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail title="Cost" text={resource.cost} />
              <Detail title="Hours" text={resource.hours} />
              <Detail title="Languages" text={resource.languages} />
              <Detail title="Accessibility" text={resource.accessibility} />
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-green-soft p-3.5 text-xs leading-relaxed text-ink-soft">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-green">
              <ShieldCheck className="size-3.5" />
              Verified synthetic test resource
            </span>
            Checked {verifiedDate}. This 2.0 demo uses fictional organizations, .invalid URLs, and 555 phone
            numbers so it can be safely tested before real resources replace them. Always confirm availability
            and eligibility directly.
          </div>

          <button
            type="button"
            onClick={() => setReporting(true)}
            className="mt-4 text-xs font-medium text-ink-faint underline underline-offset-2"
          >
            Report outdated information
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-rule bg-surface p-4 pb-safe sm:px-7">
          {phone && (
            <Button asChild className="h-12 flex-1 rounded-xl bg-brand text-base hover:bg-brand/90">
              <a href={`tel:${phone}`}>
                <Phone className="size-4" />
                Call
              </a>
            </Button>
          )}
          {resource.website && (
            <Button asChild variant="outline" className="h-12 flex-1 rounded-xl border-rule text-base">
              <a href={resource.website} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Website
              </a>
            </Button>
          )}
          <button
            type="button"
            onClick={() => toggleSave(resource.id)}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save this resource"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rule text-ink-soft hover:bg-sunk"
          >
            <Bookmark className="size-5" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {reporting && <ReportSheet reason={reportReason} setReason={setReportReason} onCancel={() => setReporting(false)} onSubmit={submitReport} />}
    </BottomSheet>
  );
}

function Detail({ title, text }: { title: string; text?: string }) {
  if (!text || !text.trim()) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
        <p className="mt-1 text-sm italic text-ink-faint">Ask them directly</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

function ReportSheet({
  reason,
  setReason,
  onCancel,
  onSubmit,
}: {
  reason: string;
  setReason: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const id = useId();
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label="Report a problem">
      <div className="rounded-t-2xl bg-surface p-5 pb-safe sm:p-7">
        <h3 className="text-lg font-semibold text-ink">Report a problem</h3>
        <p className="mt-1 text-sm text-ink-soft">Tell a partner what looks outdated, incorrect, or unsafe. This does not contact the organization.</p>
        <label htmlFor={id} className="sr-only">What should be checked?</label>
        <Textarea
          id={id}
          value={reason}
          onChange={event => setReason(event.target.value)}
          className="mt-3 min-h-28 rounded-xl border-rule"
          placeholder="What should be checked?"
        />
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={reason.trim().length < 5} className="flex-1 rounded-xl bg-brand hover:bg-brand/90" onClick={onSubmit}>Send report</Button>
        </div>
      </div>
    </div>
  );
}
