import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet, not a dialog. Slides up, drag-to-dismiss (vaul), capped at
 * 90vh. Used for resource detail, filters, and anything that should feel
 * like a natural extension of the screen rather than an interruption.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[90vh] rounded-t-2xl border-rule bg-surface", className)}>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
