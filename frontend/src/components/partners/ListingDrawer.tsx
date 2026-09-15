import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, X } from "lucide-react";
import { BottomSheet } from "@/components/primitives/BottomSheet";
import { ResourceEditor } from "@/components/partners/ResourceEditor";
import { fetchPartnerResources, type MissingField, type ResourceItem } from "@/lib/api";
import { describeChecked } from "@/lib/checked";
import { cn } from "@/lib/utils";

export interface DrawerFilter {
  title: string;
  detail?: string;
  county?: string;
  category?: string;
  missing?: MissingField;
  stale?: boolean;
}

/**
 * The listings behind a Coverage or Gaps bar (P4, P5), in a side drawer.
 * Tap one to edit it in place (P6); the list refreshes after a save.
 */
export function ListingDrawer({ filter, onClose }: { filter: DrawerFilter | null; onClose: () => void }) {
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const open = filter !== null;
  const { data, isPending, isError } = useQuery({
    queryKey: ["partner-resources", filter?.county ?? "", filter?.category ?? "", filter?.missing ?? "", filter?.stale ?? false],
    queryFn: () => fetchPartnerResources({ county: filter?.county, category: filter?.category, missing: filter?.missing, stale: filter?.stale }),
    enabled: open,
  });
  const close = () => { setEditing(null); onClose(); };

  return (
    <BottomSheet open={open} onOpenChange={value => { if (!value) close(); }} title={filter?.title ?? "Listings"} side="auto">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3 lg:px-6">
        {editing ? (
          <button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-10 items-center gap-1.5 text-[14px] text-brand hover:underline"><ArrowLeft className="size-4" /> Back to the list</button>
        ) : (
          <div className="min-w-0">
            <h2 className="truncate font-display text-[20px] font-bold text-ink">{filter?.title}</h2>
            {filter?.detail && <p className="text-[13px] text-ink-faint">{filter.detail}</p>}
          </div>
        )}
        <button type="button" onClick={close} aria-label="Close" className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"><X className="size-5" /></button>
      </div>

      <div className="px-5 pb-16 pt-4 lg:px-6">
        {editing ? (
          <ResourceEditor resource={editing} focus={filter?.missing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        ) : isPending ? (
          <p className="flex items-center gap-2 py-8 text-ink-soft"><Loader2 className="size-4 animate-spin" /> Loading listings…</p>
        ) : isError ? (
          <p role="alert" className="py-8 text-crisis">Could not load these listings.</p>
        ) : !data?.length ? (
          <p className="py-8 text-ink-soft">Nothing here — every listing in this group is filled in.</p>
        ) : (
          <>
            <p className="text-[13px] text-ink-faint">{data.length} {data.length === 1 ? "listing" : "listings"}. Tap one to fill in what&rsquo;s missing.</p>
            <ul className="mt-2 divide-y divide-rule border-t border-rule">
              {data.map(resource => {
                const checked = describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt);
                return (
                  <li key={resource.id}>
                    <button type="button" onClick={() => setEditing(resource)} className="row-hover -mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-3 rounded-md px-2 py-3 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-ink">{resource.title}</p>
                        <p className="truncate text-[13px] text-ink-faint">{resource.organization !== resource.title ? `${resource.organization} · ` : ""}{resource.category} · {resource.county} · <span className={cn(checked.stale && "text-crisis")}>{checked.label}</span></p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
