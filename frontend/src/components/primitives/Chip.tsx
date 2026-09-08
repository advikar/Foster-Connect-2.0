import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The workhorse selection control across the new intake, filters, and
 * step-status flows. A real <button aria-pressed>, never a styled div, so it
 * stays operable by keyboard and announced correctly by screen readers.
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
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-medium transition-colors",
        selected
          ? "border-transparent bg-brand text-white"
          : "border-rule bg-sunk text-ink hover:border-brand/40",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
