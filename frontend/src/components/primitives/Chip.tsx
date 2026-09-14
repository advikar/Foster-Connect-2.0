import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The selection control for filters, intake answers and step status. A real
 * <button aria-pressed>, so it stays keyboard-operable and announced.
 * Selected is solid ink; unselected is a white pill with a rule.
 */
export function Chip({
  selected = false,
  onClick,
  children,
  icon,
  className,
  type = "button",
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors",
        selected
          ? "border-ink bg-ink text-white"
          : "border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
