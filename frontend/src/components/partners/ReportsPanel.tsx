import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveReport, type PartnerAnalytics, type ResourceItem } from "@/lib/api";
import { describeChecked } from "@/lib/checked";
import { cn } from "@/lib/utils";

export type YouthReport = PartnerAnalytics["reports"][number];

/**
 * Reports sent from a listing's "something is wrong" link. Each one opens the
 * listing in the editor (that is the fix: re-check it, correct it), and a
 * reviewer can mark it handled so it leaves Needs attention and the queue.
 */
export function ReportsPanel({ reports, reviewer, onOpen, compact = false }: {
  reports: YouthReport[];
  reviewer: boolean;
  onOpen: (report: YouthReport) => void;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const resolve = async (report: YouthReport) => {
    setBusy(report.id);
    try {
      await resolveReport(report.id);
      toast.success("Marked handled.");
      await queryClient.invalidateQueries({ queryKey: ["partner-analytics"] });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not do that just now.");
    } finally { setBusy(null); }
  };

  if (reports.length === 0) {
    return <p className={cn("rounded-md border border-dashed border-rule p-5 text-[14px] text-ink-soft", compact ? "mt-3" : "mt-3")}>No open reports. When a young person flags a listing, it appears here.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-rule border-t border-rule">
      {reports.map(report => (
        <li key={report.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <button type="button" onClick={() => onOpen(report)} className="row-hover -mx-2 min-w-0 flex-1 rounded-md px-2 py-1 text-left">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="font-semibold text-ink">{report.title}</p>
              <span className="text-stamp">Reported {agoShort(report.created_at)}</span>
            </div>
            {report.organization && report.organization !== report.title && <p className="text-[13px] text-ink-faint">{report.organization}</p>}
            <p className="mt-1 text-[14px] text-ink-soft">&ldquo;{report.reason}&rdquo;</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand">Open and edit the listing <ChevronRight className="size-3.5" /></p>
          </button>
          {reviewer && (
            <button type="button" disabled={busy === report.id} onClick={() => void resolve(report)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-md border border-rule px-3 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50">
              {busy === report.id && <Loader2 className="size-3.5 animate-spin" />} Mark handled
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function agoShort(iso: string) {
  const then = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One listing as a row a partner can tap to edit. Used by the Directory
 * search and by the Staff guide's "From the directory" list; unlike the
 * youth ResourceRow it has no Save button and opens the editor, not a sheet.
 */
export function PartnerListingButton({ resource, onOpen }: { resource: ResourceItem; onOpen: (resource: ResourceItem) => void }) {
  const checked = describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt);
  return (
    <button type="button" onClick={() => onOpen(resource)} className="row-hover -mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-3 rounded-md px-2 py-3 text-left">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink">{resource.title} <span className="font-normal text-ink-faint">#{resource.id}</span></p>
        <p className="truncate text-[13px] text-ink-faint">{resource.organization !== resource.title ? `${resource.organization} · ` : ""}{resource.category} · {resource.county} · <span className={cn(checked.stale && "text-crisis")}>{checked.label}</span></p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand">Edit <ChevronRight className="size-4" /></span>
    </button>
  );
}
