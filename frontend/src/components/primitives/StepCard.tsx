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
 * "Stuck" matters most: services turn young people away constantly. Tapping
 * it records what happened (blockerReason) and offers to take that to Maya
 * so the plan keeps moving.
 */
export function StepCard({
  task, resource, index, current = false, onUpdate, onAskMaya,
}: {
  task: RoadmapTask;
  resource?: ResourceItem;
  index: number;
  /** The single highlighted "do this next" step. */
  current?: boolean;
  onUpdate: (update: { status?: TaskStatus; blockerReason?: string }) => void;
  onAskMaya: (context: string) => void;
}) {
  const [pickingReason, setPickingReason] = useState(false);
  const done = task.status === "completed";
  const stuck = task.status === "blocked";
  const phone = resource?.phone?.replace(/[^\d+]/g, "");
  const number = String(index + 1).padStart(2, "0");

  const chooseReason = (reason: string) => {
    onUpdate({ status: "blocked", blockerReason: reason });
    setPickingReason(false);
  };

  return (
    <div className={cn("grid grid-cols-[28px_1fr] gap-3 rounded-md border p-4 lg:grid-cols-[36px_1fr] lg:gap-4 lg:p-5", current ? "border-ink bg-surface" : done ? "border-rule-soft" : "border-rule")}>
      <button
        type="button"
        onClick={() => onUpdate({ status: done ? "not_started" : "completed" })}
        aria-label={done ? `Mark not done: ${task.taskText}` : `Mark done: ${task.taskText}`}
        className={cn(
          "mt-0.5 flex size-7 items-center justify-center rounded-full border-[1.5px] transition-colors",
          done ? "border-brand bg-brand text-white" : "border-rule text-transparent hover:border-brand",
        )}
      >
        <Check className="size-3.5" strokeWidth={2.6} />
      </button>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <span className={cn("text-eyebrow", current ? "text-crisis" : "text-ink-stamp")}>{number}</span>
          <h3 className={cn("font-sans text-[16px] font-semibold leading-snug lg:text-[17px]", done ? "text-ink-faint line-through" : "text-ink")}>{task.taskText}</h3>
        </div>
        {!done && task.whyItMatters && <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-ink-soft">{task.whyItMatters}</p>}

        {!done && resource && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-faint">
            <span className="font-medium text-ink-soft">{resource.title}</span>
            <span className="text-stamp">{resource.county}</span>
            {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Phone className="size-3.5" />{resource.phone}</a>}
            {resource.website && <a href={resource.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><ExternalLink className="size-3.5" />Website</a>}
          </div>
        )}

        {!done && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => onUpdate({ status: "completed" })} className="inline-flex min-h-10 items-center rounded-md border border-ink px-3.5 text-[14px] font-semibold text-ink hover:bg-sand-soft">Done</button>
            <Chip selected={task.status === "in_progress"} onClick={() => onUpdate({ status: "in_progress" })}>Working on it</Chip>
            <Chip selected={stuck} onClick={() => setPickingReason(value => !value)}>Stuck?</Chip>
            <button
              type="button"
              onClick={() => onAskMaya(`I need help with this step: "${task.taskText}".`)}
              className="inline-flex min-h-10 items-center gap-1.5 px-2 text-[14px] font-semibold text-brand hover:underline"
            >
              <MessageCircle className="size-4" />
              Ask Maya
            </button>
          </div>
        )}

        {pickingReason && (
          <div className="mt-3 rounded-md bg-sunk p-3">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">What happened?</p>
            <div className="flex flex-wrap gap-2">
              {STUCK_REASONS.map(reason => (
                <Chip key={reason} selected={task.blockerReason === reason} onClick={() => chooseReason(reason)}>{reason}</Chip>
              ))}
            </div>
          </div>
        )}

        {stuck && !pickingReason && (
          <div className="mt-3 rounded-md bg-sand-soft px-3.5 py-2.5 text-[14px] text-ink-soft">
            <p>Being turned away is information, not failure.{task.blockerReason ? ` You told us: “${task.blockerReason}.”` : ""}</p>
            <button
              type="button"
              onClick={() => onAskMaya(`I'm stuck on this step: "${task.taskText}". What happened: ${task.blockerReason || "not specified"}. Can you suggest another way?`)}
              className="mt-1 inline-flex items-center gap-1 text-[14px] font-semibold text-brand hover:underline"
            >
              <MessageCircle className="size-3.5" />
              Ask Maya for another way
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
