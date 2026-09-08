import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, PencilLine, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/primitives/StepCard";
import { IntakeConversation } from "@/components/roadmap/IntakeConversation";
import { useMaya } from "@/contexts/MayaContext";
import { dialString } from "@/lib/crisis";
import {
  fetchRoadmap, fetchRoadmaps, generateRoadmap, updateTask,
  type CrisisContact, type Roadmap, type RoadmapDeferredResponse,
  type RoadmapIntake, type RoadmapTask,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function RoadmapPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [deferred, setDeferred] = useState<{ response: RoadmapDeferredResponse; input: RoadmapIntake } | null>(null);
  const { data: roadmaps = [], isLoading: loadingRoadmaps, isError: roadmapsFailed } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  useEffect(() => { if (!activeId && roadmaps[0]) setActiveId(roadmaps[0].id); }, [roadmaps, activeId]);
  const { data: roadmap, isLoading: loadingRoadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });

  const create = async (input: RoadmapIntake) => {
    setBuilding(true);
    try {
      const result = await generateRoadmap(input);
      // Non-negotiable per the safety module: a disclosure in the intake
      // must interrupt with crisis support immediately, never be silently
      // discarded or turned into a broken roadmap render.
      if ("roadmapDeferred" in result) {
        setDeferred({ response: result, input });
        return;
      }
      setDeferred(null);
      queryClient.setQueryData(["roadmap", result.id], result);
      await queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      setActiveId(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn\u2019t build that just now. Try again in a moment.");
    } finally {
      setBuilding(false);
    }
  };

  // A spinner that never resolves is the worst thing this page can do. If the
  // plan list cannot be loaded, fall through to the intake — it runs entirely
  // in the browser and only needs the network at the very end.
  if (!roadmapsFailed && (loadingRoadmaps || (activeId && loadingRoadmap))) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading your plan">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }
  if (deferred) {
    return (
      <CrisisDeferred
        response={deferred.response}
        onContinue={() => create({ ...deferred.input, acknowledgedSafety: true })}
        continuing={building}
      />
    );
  }
  if (!activeId || !roadmap) return <IntakeConversation onSubmit={create} building={building} />;
  return <JourneyPlan roadmap={roadmap} onNew={() => setActiveId(null)} />;
}

/** Shown when the intake text itself triggered a crisis assessment. Support first; the plan waits. */
function CrisisDeferred({ response, onContinue, continuing }: { response: RoadmapDeferredResponse; onContinue: () => void; continuing: boolean }) {
  return (
    <div className="mx-auto w-full px-5 lg:px-10 max-w-[640px] py-12">
      <p className="text-sm leading-relaxed text-ink">{response.reply}</p>
      <div className="mt-5 space-y-3 rounded-2xl border border-crisis/25 bg-crisis-soft p-4">
        {response.crisisContacts.map((contact: CrisisContact) => (
          <div key={contact.id} className="text-sm">
            <p className="font-semibold text-ink">{contact.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-ink-soft">
              {contact.phone && (
                <a href={`tel:${dialString(contact.phone)}`} className="inline-flex items-center gap-1 font-medium text-crisis underline underline-offset-2">
                  <Phone className="size-3.5" />
                  {contact.phone}
                </a>
              )}
              {contact.text && <span>{contact.text}</span>}
            </div>
          </div>
        ))}
      </div>
      <Button onClick={onContinue} disabled={continuing} variant="outline" className="mt-6 h-12 w-full rounded-xl border-rule">
        {continuing ? <Loader2 className="size-4 animate-spin" /> : null}
        Continue to my plan
      </Button>
    </div>
  );
}

const GROUP_TIMEFRAMES: Record<"now" | "soon" | "later", RoadmapTask["timeframe"][]> = {
  now: ["This Week"],
  soon: ["30 Days"],
  later: ["3-6 Months", "6-12 Months"],
};

/**
 * The plan, shown as Right now / Soon / When you're ready instead of four
 * fixed timeline phases. A young person with one urgent need used to see
 * three mostly-empty future sections — that read as "you are behind,"
 * which principle 3 forbids. Right now is the only thing open by default;
 * completing something there pulls the next item up.
 */
function JourneyPlan({ roadmap, onNew }: { roadmap: Roadmap; onNew: () => void }) {
  const queryClient = useQueryClient();
  const { openMaya } = useMaya();
  const [soonOpen, setSoonOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const resourceMap = useMemo(() => new Map(roadmap.recommendedResources.map(resource => [resource.id, resource])), [roadmap]);

  const active = roadmap.tasks.filter(task => task.status !== "completed");
  const done = roadmap.tasks.filter(task => task.status === "completed");
  const grouped = {
    now: active.filter(task => GROUP_TIMEFRAMES.now.includes(task.timeframe)),
    soon: active.filter(task => GROUP_TIMEFRAMES.soon.includes(task.timeframe)),
    later: active.filter(task => GROUP_TIMEFRAMES.later.includes(task.timeframe)),
  };

  const mutation = useMutation({
    mutationFn: ({ id, update }: { id: number; update: Parameters<typeof updateTask>[1] }) => updateTask(id, update),
    onSuccess: task => {
      queryClient.setQueryData<Roadmap>(["roadmap", roadmap.id], previous => previous ? { ...previous, tasks: previous.tasks.map(item => item.id === task.id ? task : item) } : previous);
      if (task.status === "completed") toast.success("That step counts. Nice work.", { icon: "✓" });
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not update the step"),
  });

  const renderTask = (task: RoadmapTask) => (
    <StepCard
      key={task.id}
      task={task}
      resource={task.resourceId ? resourceMap.get(task.resourceId) : undefined}
      onUpdate={update => mutation.mutate({ id: task.id, update: update as Partial<Pick<RoadmapTask, "status" | "blockerReason">> })}
      onAskMaya={context => openMaya(context)}
    />
  );

  return (
    <div className="mx-auto w-full px-5 lg:px-10 max-w-[880px] py-7 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-eyebrow text-ink-faint">Your plan</p>
          <h1 className="text-display-sm mt-2 text-ink">{roadmap.title}</h1>
        </div>
        <Button onClick={onNew} variant="outline" size="sm" className="rounded-full border-rule"><PencilLine className="size-3.5" />Start another</Button>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">{roadmap.goalSummary}</p>
      {done.length > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-green">
          <Check className="size-4" strokeWidth={2.5} aria-hidden />
          {done.length} thing{done.length === 1 ? "" : "s"} done
        </p>
      )}

      <div className="mt-7 space-y-8">
        <PlanSection title="Right now" detail="Start anywhere in here. You don\u2019t have to go in order." tasks={grouped.now} open renderTask={renderTask} />
        <CollapsibleSection title="Soon" count={grouped.soon.length} open={soonOpen} onToggle={() => setSoonOpen(v => !v)}>
          <div className="space-y-3">{grouped.soon.map(renderTask)}</div>
        </CollapsibleSection>
        <CollapsibleSection title="When you're ready" count={grouped.later.length} open={laterOpen} onToggle={() => setLaterOpen(v => !v)}>
          <div className="space-y-3">{grouped.later.map(renderTask)}</div>
        </CollapsibleSection>
      </div>

      {done.length > 0 && (
        <CollapsibleSection title="Done" count={done.length} open={doneOpen} onToggle={() => setDoneOpen(v => !v)} className="mt-8">
          <div className="space-y-3">{done.map(renderTask)}</div>
        </CollapsibleSection>
      )}

      <p className="mt-10 border-l-2 border-sand pl-4 text-[15px] leading-relaxed text-ink-soft">
        {roadmap.closing}
      </p>
    </div>
  );
}

function PlanSection({
  title, detail, tasks, renderTask,
}: {
  title: string; detail: string; tasks: RoadmapTask[]; open?: boolean; renderTask: (task: RoadmapTask) => ReactNode;
}) {
  if (!tasks.length) return null;
  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-faint">{detail}</p>
      <div className="mt-3 space-y-3">{tasks.map(renderTask)}</div>
    </section>
  );
}

function CollapsibleSection({
  title, count, open, onToggle, children, className,
}: {
  title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode; className?: string;
}) {
  if (!count) return null;
  return (
    <section className={className}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between text-left">
        <span className="font-display text-xl font-bold tracking-[-0.025em] text-ink">{title} <span className="font-sans text-sm font-medium text-ink-faint">({count})</span></span>
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
