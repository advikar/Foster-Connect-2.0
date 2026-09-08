import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useMaya } from "@/contexts/MayaContext";

/**
 * Persistent "Ask Maya" affordance, bottom-right, above the tab bar.
 * Opens the full-screen conversation — never a small floating window.
 */
export function MayaLauncher() {
  const { open, openMaya } = useMaya();
  const { pathname } = useLocation();
  // Hidden on the plan route: the intake conversation is already Maya, and
  // the launcher would sit on top of its sticky Next button.
  if (open || pathname === "/roadmap") return null;
  return (
    <button
      type="button"
      onClick={() => openMaya()}
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-on-brand shadow-lg shadow-brand/25 lg:bottom-6"
    >
      <MessageCircle className="size-4" />
      Ask Maya
    </button>
  );
}
