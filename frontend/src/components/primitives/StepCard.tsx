import { useState } from "react";
import { Check, ExternalLink, MessageCircle, Phone } from "lucide-react";
import { Chip } from "@/components/primitives/Chip";
import type { ResourceItem, RoadmapTask, TaskStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STUCK_REASONS = [
  "No answer",
  "Waitlist",
  "Said I don't qualify",
  "Needed a document I don't have",
  "Couldn't get there",
];

/**
 * StepCard — one item in the plan.
 *
 * "Stuck" is the most important control here: services turn young people
 * away constantly, and today the only option used to be a dead-end
 * "blocked" state. Tapping Stuck asks what happened, records it as the
 * task's blockerReason (existing field, no backend change needed), and
 * offers to bring the reason into a conversation with Maya so the plan
 * keeps moving instead of just sitting there.
 */
export function StepCard({
  task,
  resource,
  onUpdate,
  onAskMaya,
}: {
  task: RoadmapTask;
  resource?: ResourceItem;
  onUpdate: (update: { status?: TaskStatus; blockerReason?: string }) => void;
  onAskMaya: (context: string) => void;
}) {
  const [pickingReason, setPickingReason] = useState(false);
  const done = task.status === "completed";
  const stuck = task.status === "blocked";
  const phone = resource?.phone?.replace(/[^\d+]/g, "");

  const chooseReason = (reason: string) => {
    onUpdate({ status: "blocked", blockerReason: reason });
    setPickingReason(false);
  };

  return (
    <div className={cn("rounded-2xl border p-5", done ? "border-green/25 bg-green-soft/60" : stuck ? "border-warm/30 bg-warm-soft/40" : "border-rule bg-surface")}>
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => onUpdate({ status: done ? "not_started" : "completed" })}
          aria-label={done ? `Mark not done: ${task.taskText}` : `Mark done: ${task.taskText}`}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-green bg-green text-white" : "border-rule text-transparent hover:border-brand/50",
          )}
        >
          <Check className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <h3 className={cn("text-base font-semibold leading-snug", done ? "text-ink-soft line-through decoration-ink-faint/50" : "text-ink")}>
            {task.taskText}
          </h3>
          {task.whyItMatters && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{task.whyItMatters}</p>}

          {resource && (phone || resource.website) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
                  <Phone className="size-3.5" />
                  {resource.phone}
                </a>
              )}
              {resource.website && (
                <a href={resource.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink-soft">
                  <ExternalLink className="size-3.5" />
                  Website
                </a>
              )}
            </div>
          )}

          {!done && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip selected={task.status === "in_progress"} onClick={() => onUpdate({ status: "in_progress" })}>Working on it</Chip>
              <Chip selected={stuck} onClick={() => setPickingReason(value => !value)}>Stuck</Chip>
              <button
                type="button"
                onClick={() => onAskMaya(`I need help with this step: "${task.taskText}".`)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
              >
                <MessageCircle className="size-3.5" />
                Ask Maya
              </button>
            </div>
          )}

          {pickingReason && (
            <div className="mt-3 rounded-xl bg-sunk p-3">
              <p className="mb-2 text-xs font-medium text-ink-soft">What happened?</p>
              <div className="flex flex-wrap gap-2">
                {STUCK_REASONS.map(reason => (
                  <Chip key={reason} selected={task.blockerReason === reason} onClick={() => chooseReason(reason)}>
                    {reason}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {stuck && !pickingReason && (
            <div className="mt-3 rounded-xl bg-warm-soft px-3.5 py-2.5 text-sm text-ink-soft">
              <p>Being turned away is information, not failure. {task.blockerReason ? `You told us: “${task.blockerReason}.”` : ""}</p>
              <button
                type="button"
                onClick={() => onAskMaya(`I'm stuck on this step: "${task.taskText}". What happened: ${task.blockerReason || "not specified"}. Can you suggest another way?`)}
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand"
              >
                <MessageCircle className="size-3.5" />
                Ask Maya for another way
              </button>
            </div>
          )}

          {task.motivationNote && !done && <p className="mt-3 text-xs italic text-ink-faint">{task.motivationNote}</p>}
        </div>
      </div>
    </div>
  );
}
