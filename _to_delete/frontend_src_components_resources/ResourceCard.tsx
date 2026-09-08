import { useState } from "react";
import { Bookmark, CheckCircle2, Clock3, ExternalLink, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { reportResource, saveResource, type ResourceItem } from "@/lib/api";
import { toast } from "sonner";

export function ResourceCard({ resource, compact = false }: { resource: ResourceItem; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const verifiedDate = new Date(`${resource.verifiedAt}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const handleSave = async () => {
    await saveResource(resource.id);
    setSaved(true);
    toast.success("Saved for later");
  };

  return (
    <>
      <Card className="group h-full rounded-2xl border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className={compact ? "p-4" : "p-5"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">{resource.category}</Badge>
                {resource.urgencyLevel !== "Standard" && (
                  <Badge className={resource.isCrisis ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"} variant="outline">
                    {resource.urgencyLevel}
                  </Badge>
                )}
              </div>
              <h3 className="text-base font-bold leading-snug text-slate-900">{resource.title}</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">{resource.organization}</p>
            </div>
            <button type="button" onClick={handleSave} className="rounded-xl p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label={`Save ${resource.title}`}>
              <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{resource.description}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{resource.county}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{resource.deliveryMode}</span>
            <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck className="size-3.5" />Checked {verifiedDate}</span>
          </div>
          <Button type="button" variant="outline" aria-label={`See details for ${resource.title}`} onClick={() => setOpen(true)} className="mt-4 w-full rounded-xl border-slate-200">See details and next steps</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-3xl p-0">
          <div className="bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8">
            <DialogHeader>
              <div className="mb-2 flex flex-wrap gap-2"><Badge>{resource.category}</Badge><Badge variant="outline">{resource.county}</Badge></div>
              <DialogTitle className="text-2xl text-slate-900">{resource.title}</DialogTitle>
              <p className="text-sm text-slate-500">{resource.organization}</p>
            </DialogHeader>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{resource.description}</p>
          </div>
          <div className="space-y-5 p-6 sm:p-8">
            <Detail title="Who may qualify" text={resource.eligibility} />
            <Detail title="How to start" text={resource.applicationSteps} />
            <Detail title="What to bring" text={resource.whatToBring} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail title="Cost" text={resource.cost} />
              <Detail title="Hours" text={resource.hours || "Confirm directly"} />
              <Detail title="Languages" text={resource.languages || "Ask directly"} />
              <Detail title="Accessibility" text={resource.accessibility || "Ask directly"} />
            </div>
            <Separator />
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" />Verified synthetic test resource</div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">Checked {verifiedDate}. This 2.0 demo uses fictional organizations, .invalid URLs, and 555 phone numbers so it can be safely tested before real resources replace them. Always confirm availability and eligibility.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {resource.phone && <Button asChild className="rounded-xl"><a href={`tel:${resource.phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" />Call</a></Button>}
              {resource.website && <Button asChild variant="outline" className="rounded-xl"><a href={resource.website} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Website</a></Button>}
              <Button type="button" variant="outline" onClick={handleSave} className="rounded-xl"><Bookmark className="size-4" />{saved ? "Saved" : "Save"}</Button>
              <Button type="button" variant="ghost" onClick={() => setReporting(true)} className="rounded-xl text-slate-500">Report outdated information</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Report a problem</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Tell a partner what looks outdated, incorrect, or unsafe. This does not contact the organization.</p>
          <textarea value={reportReason} onChange={event => setReportReason(event.target.value)} className="min-h-28 rounded-xl border border-slate-200 p-3 text-sm" placeholder="What should be checked?" />
          <Button disabled={reportReason.trim().length < 5} onClick={async () => { await reportResource(resource.id, reportReason); setReporting(false); setReportReason(""); toast.success("Sent to a partner for review"); }}>Send report</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p></div>;
}
