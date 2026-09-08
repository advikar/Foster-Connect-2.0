import { Home, FileText, Heart, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Find housing resources", icon: Home },
  { label: "Create my 90-day roadmap", icon: FileText },
  { label: "Mental health support", icon: Heart },
  { label: "Job training programs", icon: Briefcase },
] as const;

interface QuickActionsProps {
  onSelect: (action: string) => void;
  compact?: boolean;
}

export function QuickActions({ onSelect, compact }: QuickActionsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "px-3 pb-2" : "px-6 pb-2")}>
      {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white text-emerald-700",
            "hover:bg-emerald-50 hover:border-emerald-300 transition-all font-medium shadow-sm",
            compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
          )}
        >
          <Icon className={compact ? "size-3" : "size-3.5"} />
          {label}
        </button>
      ))}
    </div>
  );
}
