import { useId } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** "Something is wrong" sheet shared by listings, the Ask page and the crisis dialog. */
export function ReportSheet({ reason, setReason, onCancel, onSubmit, intro }: {
  reason: string; setReason: (value: string) => void; onCancel: () => void; onSubmit: () => void; intro?: string;
}) {
  const id = useId();
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-brand-deep/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Report a problem">
      <div className="w-full max-w-md rounded-lg bg-ground p-6">
        <h3 className="font-display text-[22px] font-bold text-ink">Report a problem</h3>
        <p className="mt-1.5 text-[14px] text-ink-soft">{intro ?? "Tell a partner what looks outdated, incorrect, or unsafe. This does not contact the organization."}</p>
        <label htmlFor={id} className="mt-4 block text-[13px] font-semibold text-ink-soft">What should be checked?</label>
        <Textarea id={id} value={reason} onChange={event => setReason(event.target.value)} placeholder="The number doesn't work, they moved, it's not free any more…" className="mt-1.5 min-h-24 rounded-md border-rule bg-surface text-base" />
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-md border-ink" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={reason.trim().length < 5} className="h-11 rounded-md bg-brand text-white hover:bg-brand-deep" onClick={onSubmit}>Send report</Button>
        </div>
      </div>
    </div>
  );
}
