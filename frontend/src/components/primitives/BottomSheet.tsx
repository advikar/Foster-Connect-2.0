import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * A sheet that slides up on phones and in from the right on wider screens.
 * Drag-to-dismiss (vaul). Used for resource detail and filters.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  side = "auto",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** "auto" = bottom on phones, right panel on desktop. */
  side?: "auto" | "bottom";
}) {
  const isMobile = useIsMobile();
  const direction = side === "bottom" || isMobile ? "bottom" : "right";
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={direction}>
      <DrawerContent
        className={cn(
          "border-rule bg-ground",
          direction === "bottom"
            ? "max-h-[92vh] rounded-t-2xl"
            : "h-full w-full rounded-none data-[vaul-drawer-direction=right]:sm:max-w-[640px]",
          className,
        )}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
