import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, PencilLine, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/primitives/StepCard";
import { describeChecked } from "@/lib/checked";
import { IntakeConversation } from "@/components/roadmap/IntakeConversation";
import { useNova } from "@/contexts/NovaContext";
import { dialString } from "@/lib/crisis";
import {
  addTask, deleteTask, fetchRoadmap, fetchRoadmaps, generateRoadmap, updateTask,
  type CrisisContact, type NewTask, type Roadmap, type RoadmapDeferredResponse,
  type RoadmapIntake, type RoadmapTask, type TaskUpdate,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function RoadmapPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  // "Start a new plan" used to clear activeId, and the effect below promptly
  // re-selected the first existing plan. This flag keeps the intake open.
  const [startingNew, setStartingNew] = useState(false);
  const [building, setBuilding] = useState(false);
  const [deferred, setDeferred] = useState<{ response: RoadmapDeferredResponse; input: RoadmapIntake } | null>(null);
  const { data: roadmaps = [], isPending: loadingRoadmaps, isError: roadmapsFailed } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  useEffect(() => { if (!activeId && !startingNew && roadmaps[0]) setActiveId(roadmaps[0].id); }, [roadmaps, activeId, startingNew]);
  const { data: roadmap, isPending: loadingRoadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });

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
      setStartingNew(false);
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
  if (startingNew || !activeId || !roadmap) {
    return (
      <IntakeConversation
        onSubmit={create}
        building={building}
        onCancel={startingNew && roadmaps[0] ? () => { setStartingNew(false); setActiveId(roadmaps[0].id); } : undefined}
      />
    );
  }
  return <JourneyPlan roadmap={roadmap} onNew={() => { setStartingNew(true); setActiveId(null); }} />;
}

/** Shown when the intake text itself triggered a crisis assessment. Support first; the plan waits. */
function CrisisDeferred({ response, onContinue, continuing }: { response: RoadmapDeferredResponse; onContinue: () => void; continuing: boolean }) {
  return (
    <div className="container-wide"><div className="max-w-[720px] py-10 lg:py-16">
      <p className="text-[17px] leading-relaxed text-ink-body">{response.reply}</p>
      <div className="mt-5 space-y-3 rounded-md border border-crisis/30 bg-crisis-soft p-5">
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
      <Button onClick={onContinue} disabled={continuing} variant="outline" className="mt-6 h-12 rounded-md border-ink px-5 text-[15px] font-semibold text-ink">
        {continuing ? <Loader2 className="size-4 animate-spin" /> : null}
        Continue to my plan
      </Button>
    </div></div>
  );
}

const GROUP_TIMEFRAMES: Record<"now" | "soon" | "later", RoadmapTask["timeframe"][]> = {
  now: ["This Week"],
  soon: ["30 Days"],
  later: ["3-6 Months", "6-12 Months"],
};

/**
 * The plan: the goal in the young person's own words, one highlighted next
 * step, then Now / Soon / Later. Done steps collapse under the list so the
 * page never reads as "you are behind".
 */
function JourneyPlan({ roadmap, onNew }: { roadmap: Roadmap; onNew: () => void }) {
  const queryClient = useQueryClient();
  const { openNova } = useNova();
  const [doneOpen, setDoneOpen] = useState(false);
  const resourceMap = useMemo(() => new Map(roadmap.recommendedResources.map(resource => [resource.id, resource])), [roadmap]);

  const ordered = [...roadmap.tasks].sort((a, b) => a.taskOrder - b.taskOrder);
  const indexOf = new Map(ordered.map((task, index) => [task.id, index]));
  const active = ordered.filter(task => task.status !== "completed");
  const done = ordered.filter(task => task.status === "completed");
  const current = active.find(task => task.status !== "blocked") ?? active[0];
  const grouped = {
    now: active.filter(task => GROUP_TIMEFRAMES.now.includes(task.timeframe)),
    soon: active.filter(task => GROUP_TIMEFRAMES.soon.includes(task.timeframe)),
    later: active.filter(task => GROUP_TIMEFRAMES.later.includes(task.timeframe)),
  };
  const programs = roadmap.recommendedResources.filter(resource => ordered.some(task => task.resourceId === resource.id));

  const setTasks = (updater: (tasks: RoadmapTask[]) => RoadmapTask[]) =>
    queryClient.setQueryData<Roadmap>(["roadmap", roadmap.id], previous => previous ? { ...previous, tasks: updater(previous.tasks) } : previous);
  const refetchPlan = () => queryClient.invalidateQueries({ queryKey: ["roadmap", roadmap.id] });

  const mutation = useMutation({
    mutationFn: ({ id, update }: { id: number; update: TaskUpdate }) => updateTask(id, update),
    onSuccess: task => {
      setTasks(tasks => tasks.map(item => item.id === task.id ? task : item));
      if (task.status === "completed") toast.success("That step counts. Nice work.");
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not update the step"),
  });

  /* ── Editing by hand (Y4) ─────────────────────────────────────────────── */
  const add = useMutation({
    mutationFn: (input: NewTask) => addTask(roadmap.id, input),
    onSuccess: () => { void refetchPlan(); toast.success("Added to your plan."); },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not add that step"),
  });
  const remove = useMutation({
    mutationFn: (task: RoadmapTask) => deleteTask(task.id),
    onSuccess: (_, task) => {
      setTasks(tasks => tasks.filter(item => item.id !== task.id));
      toast("Step removed", {
        action: { label: "Undo", onClick: () => add.mutate({ taskText: task.taskText, timeframe: task.timeframe, whyItMatters: task.whyItMatters, taskCategory: task.taskCategory, resourceId: task.resourceId }) },
      });
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not remove that step"),
  });
  /** Swap task_order with the neighbour in the same section, then refresh from the server. */
  const move = async (task: RoadmapTask, direction: "up" | "down") => {
    const section = ordered.filter(item => item.status !== "completed" && sameGroup(item.timeframe, task.timeframe));
    const position = section.findIndex(item => item.id === task.id);
    const neighbour = section[direction === "up" ? position - 1 : position + 1];
    if (!neighbour) return;
    try {
      await Promise.all([
        updateTask(task.id, { taskOrder: neighbour.taskOrder }),
        updateTask(neighbour.id, { taskOrder: task.taskOrder }),
      ]);
      await refetchPlan();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move that step");
    }
  };

  const renderTask = (task: RoadmapTask) => {
    const section = ordered.filter(item => item.status !== "completed" && sameGroup(item.timeframe, task.timeframe));
    const position = section.findIndex(item => item.id === task.id);
    return (
      <StepCard
        key={task.id}
        task={task}
        index={indexOf.get(task.id) ?? 0}
        current={current?.id === task.id}
        resource={task.resourceId ? resourceMap.get(task.resourceId) : undefined}
        onUpdate={update => mutation.mutate({ id: task.id, update: update as TaskUpdate })}
        onAskNova={context => openNova(context)}
        editing={{
          onEdit: update => mutation.mutate({ id: task.id, update }),
          onMove: direction => { void move(task, direction); },
          onRemove: () => remove.mutate(task),
          canMoveUp: position > 0,
          canMoveDown: position >= 0 && position < section.length - 1,
        }}
      />
    );
  };

  const made = new Date(roadmap.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="container-wide grid gap-10 pt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16 lg:pt-12">
      <div className="flex flex-col gap-9">
        <div>
          <p className="text-eyebrow text-brand">Your plan · made {made} · {done.length} of {ordered.length} done</p>
          <h1 className="mt-3 text-display text-ink lg:text-[44px]">&ldquo;{roadmap.title}&rdquo;</h1>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-soft">{roadmap.goalSummary}</p>
          <div className="mt-4 flex gap-1">
            {ordered.map(task => <span key={task.id} className={cn("h-1 flex-1 rounded-sm", task.status === "completed" ? "bg-brand" : "bg-rule")} />)}
          </div>
          {roadmap.generatedBy === "fallback" && (
            <p className="mt-4 max-w-xl rounded-md border border-rule bg-sunk px-4 py-3 text-[14px] leading-relaxed text-ink-soft" role="status">
              Nova couldn&rsquo;t help write this one, so it was built straight from the checked directory. Every step is still real. Ask Nova later if you want it reworked.
            </p>
          )}
        </div>

        <PlanSection eyebrow="Now · this week" tone="crisis" tasks={grouped.now} renderTask={renderTask} onAdd={text => add.mutate({ taskText: text, timeframe: "This Week" })} adding={add.isPending} />
        <PlanSection eyebrow="Soon · next 30 days" tasks={grouped.soon} renderTask={renderTask} onAdd={text => add.mutate({ taskText: text, timeframe: "30 Days" })} adding={add.isPending} />
        <PlanSection eyebrow="When you're ready" tasks={grouped.later} renderTask={renderTask} onAdd={text => add.mutate({ taskText: text, timeframe: "3-6 Months" })} adding={add.isPending} />
        {active.length === 0 && (
          <p className="rounded-md bg-green-soft p-5 text-[15px] font-semibold text-green">Everything on this plan is done. Add a step above, or start another plan whenever you want.</p>
        )}

        {done.length > 0 && (
          <section>
            <button type="button" onClick={() => setDoneOpen(v => !v)} aria-expanded={doneOpen} className="flex min-h-10 items-center gap-2 text-eyebrow text-brand">
              Done · {done.length}
              <ChevronDown className={cn("size-4 transition-transform", doneOpen && "rotate-180")} />
            </button>
            {doneOpen && <div className="mt-3 flex flex-col gap-2.5">{done.map(renderTask)}</div>}
          </section>
        )}

        <p className="border-t border-rule pt-5 text-[15px] leading-relaxed text-ink-soft">{roadmap.closing}</p>
      </div>

      <aside className="flex flex-col gap-6">
        {current && (
          <section className="flex flex-col gap-3 rounded-md bg-sand-soft p-6">
            <h2 className="font-display text-[22px] font-bold text-ink">Stuck on a step?</h2>
            <p className="text-[15px] leading-relaxed text-ink-soft">Tell Nova what&rsquo;s in the way. She can swap the step, find another program, or break it smaller. You can also change, move or remove any step yourself from its <span className="whitespace-nowrap">&ldquo;&hellip;&rdquo; menu</span>.</p>
            <button type="button" onClick={() => openNova(`I'm working on this step from my plan: "${current.taskText}". What should I know before I start?`)} className="inline-flex min-h-11 items-center self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface">
              Ask Nova about step {String((indexOf.get(current.id) ?? 0) + 1).padStart(2, "0")}
            </button>
          </section>
        )}
        {programs.length > 0 && (
          <section className="rounded-md border border-rule p-6">
            <h2 className="text-eyebrow text-ink-faint">Programs in this plan</h2>
            <ul className="mt-2 divide-y divide-rule">
              {programs.map(resource => (
                <li key={resource.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{resource.title}</p><p className="text-[13px] text-ink-faint">{resource.county}</p></div>
                  <span className="text-stamp shrink-0">{describeChecked(resource.verifiedAt, resource.checkedHow, resource.recheckAt).label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="text-[14px] leading-relaxed text-ink-faint">
          <p>This plan is kept for this browser only. Clearing your browser data removes it.</p>
          <div className="mt-1 flex flex-wrap gap-4">
            <button type="button" onClick={onNew} className="inline-flex min-h-9 items-center gap-1 text-brand hover:underline"><PencilLine className="size-3.5" /> Start a new plan</button>
            <Link to="/privacy" className="inline-flex min-h-9 items-center text-brand hover:underline">Download or delete my data</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function sameGroup(a: RoadmapTask["timeframe"], b: RoadmapTask["timeframe"]) {
  const groupOf = (frame: RoadmapTask["timeframe"]) => (Object.keys(GROUP_TIMEFRAMES) as (keyof typeof GROUP_TIMEFRAMES)[]).find(key => GROUP_TIMEFRAMES[key].includes(frame));
  return groupOf(a) === groupOf(b);
}

/** A section of the plan. Always rendered when it can take a new step, so "Add a step" is available even when empty. */
function PlanSection({ eyebrow, tone = "muted", tasks, renderTask, onAdd, adding = false }: {
  eyebrow: string; tone?: "crisis" | "muted"; tasks: RoadmapTask[]; renderTask: (task: RoadmapTask) => ReactNode;
  onAdd?: (text: string) => void; adding?: boolean;
}) {
  if (!tasks.length && !onAdd) return null;
  return (
    <section>
      <h2 className={cn("text-eyebrow", tone === "crisis" ? "text-crisis" : "text-ink-faint")}>{eyebrow}</h2>
      <div className="mt-3 flex flex-col gap-2.5">
        {tasks.map(renderTask)}
        {onAdd && <AddStep onAdd={onAdd} adding={adding} quiet={tasks.length === 0} />}
      </div>
    </section>
  );
}

/** "Add a step" — a quiet link that opens a one-line form (Y4). */
function AddStep({ onAdd, adding, quiet }: { onAdd: (text: string) => void; adding: boolean; quiet: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const submit = () => {
    const value = text.trim();
    if (value.length < 3) return;
    onAdd(value); setText(""); setOpen(false);
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex min-h-10 items-center gap-1.5 self-start text-[14px] font-semibold text-brand hover:underline", quiet && "text-ink-faint hover:text-brand")}>
        <Plus className="size-4" /> Add a step
      </button>
    );
  }
  return (
    <form onSubmit={event => { event.preventDefault(); submit(); }} className="flex flex-col gap-2 rounded-md border border-ink bg-surface p-3">
      <label htmlFor="add-step" className="text-[13px] font-medium text-ink-soft">What&rsquo;s the step, in your words?</label>
      <input id="add-step" ref={inputRef} value={text} onChange={event => setText(event.target.value)} maxLength={300} placeholder="e.g. Ask my worker for a copy of my court letter" className="h-11 rounded-md border border-rule bg-surface px-3 text-[16px] text-ink outline-none focus:border-ink" />
      <div className="flex gap-2">
        <Button type="submit" disabled={adding || text.trim().length < 3} className="h-10 rounded-md bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-deep">{adding ? <Loader2 className="size-4 animate-spin" /> : null} Add</Button>
        <button type="button" onClick={() => { setOpen(false); setText(""); }} className="px-2 text-[14px] text-ink-soft hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
