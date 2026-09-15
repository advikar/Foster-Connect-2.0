import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, MessageCircle, MoreHorizontal, PencilLine, Phone, Trash2 } from "lucide-react";
import { Chip } from "@/components/primitives/Chip";
import type { ResourceItem, RoadmapTask, TaskStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const TIMEFRAME_LABELS: Record<RoadmapTask["timeframe"], string> = {
  "This Week": "Now · this week",
  "30 Days": "Soon · next 30 days",
  "3-6 Months": "When you're ready",
  "6-12 Months": "Later this year",
};

/** What the person can do to a step by hand (Y4). All optional so the card also works read-only. */
export interface StepEditing {
  onEdit?: (update: { taskText?: string; timeframe?: RoadmapTask["timeframe"] }) => void;
  onMove?: (direction: "up" | "down") => void;
  onRemove?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

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
  task, resource, index, current = false, onUpdate, onAskMaya, editing,
}: {
  task: RoadmapTask;
  resource?: ResourceItem;
  index: number;
  /** The single highlighted "do this next" step. */
  current?: boolean;
  onUpdate: (update: { status?: TaskStatus; blockerReason?: string }) => void;
  onAskMaya: (context: string) => void;
  editing?: StepEditing;
}) {
  const [pickingReason, setPickingReason] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [draft, setDraft] = useState(task.taskText);
  const menuRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // The field opens from the person's own click, so moving focus into it is expected.
  useEffect(() => { if (editingText) textRef.current?.focus(); }, [editingText]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [menuOpen]);
  const saveText = () => {
    const text = draft.trim();
    if (text.length >= 3 && text !== task.taskText) editing?.onEdit?.({ taskText: text });
    setEditingText(false);
  };
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
        <div className="flex items-start gap-2.5">
          <span className={cn("text-eyebrow pt-1", current ? "text-crisis" : "text-ink-stamp")}>{number}</span>
          {editingText ? (
            <form onSubmit={event => { event.preventDefault(); saveText(); }} className="flex min-w-0 flex-1 flex-col gap-2">
              <label htmlFor={`step-${task.id}-text`} className="sr-only">Step text</label>
              <textarea
                id={`step-${task.id}-text`}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); saveText(); } if (event.key === "Escape") { setDraft(task.taskText); setEditingText(false); } }}
                maxLength={300}
                ref={textRef}
                className="min-h-[72px] w-full rounded-md border border-ink bg-surface px-3 py-2 text-[16px] text-ink outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" className="inline-flex min-h-9 items-center rounded-md bg-brand px-3 text-[14px] font-semibold text-white">Save</button>
                <button type="button" onClick={() => { setDraft(task.taskText); setEditingText(false); }} className="inline-flex min-h-9 items-center px-2 text-[14px] text-ink-soft hover:text-ink">Cancel</button>
              </div>
            </form>
          ) : (
            <h3 className={cn("min-w-0 flex-1 font-sans text-[16px] font-semibold leading-snug lg:text-[17px]", done ? "text-ink-faint line-through" : "text-ink")}>{task.taskText}</h3>
          )}
          {editing && !editingText && (
            <div ref={menuRef} className="relative -mr-1 -mt-1 shrink-0">
              <button type="button" onClick={() => setMenuOpen(value => !value)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Change step: ${task.taskText}`} className="flex size-9 items-center justify-center rounded-md text-ink-faint hover:bg-sunk hover:text-ink">
                <MoreHorizontal className="size-5" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-rule bg-surface py-1 text-[14px] shadow-[0_12px_32px_rgba(20,20,19,0.12)]">
                  <MenuItem icon={<PencilLine className="size-4" />} onClick={() => { setMenuOpen(false); setDraft(task.taskText); setEditingText(true); }}>Change the wording</MenuItem>
                  <MenuItem icon={<ArrowUp className="size-4" />} disabled={!editing.canMoveUp} onClick={() => { setMenuOpen(false); editing.onMove?.("up"); }}>Move up</MenuItem>
                  <MenuItem icon={<ArrowDown className="size-4" />} disabled={!editing.canMoveDown} onClick={() => { setMenuOpen(false); editing.onMove?.("down"); }}>Move down</MenuItem>
                  <p className="text-eyebrow px-3 pb-1 pt-2 text-ink-faint">Move to</p>
                  {(Object.keys(TIMEFRAME_LABELS) as RoadmapTask["timeframe"][]).filter(frame => frame !== task.timeframe).map(frame => (
                    <MenuItem key={frame} onClick={() => { setMenuOpen(false); editing.onEdit?.({ timeframe: frame }); }}>{TIMEFRAME_LABELS[frame]}</MenuItem>
                  ))}
                  <div className="my-1 border-t border-rule" />
                  <MenuItem icon={<Trash2 className="size-4" />} tone="danger" onClick={() => { setMenuOpen(false); editing.onRemove?.(); }}>Remove this step</MenuItem>
                </div>
              )}
            </div>
          )}
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

function MenuItem({ children, icon, onClick, disabled = false, tone = "plain" }: { children: React.ReactNode; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "plain" | "danger" }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex w-full min-h-10 items-center gap-2.5 px-3 text-left hover:bg-sunk disabled:opacity-40 disabled:hover:bg-transparent", tone === "danger" ? "text-crisis" : "text-ink")}
    >
      {icon ?? <span className="size-4" />}
      {children}
    </button>
  );
}
