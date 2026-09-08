import { LogOut } from "lucide-react";

/**
 * Quick exit.
 *
 * A young person may be reading this on a shared device with someone nearby who
 * should not see it. This replaces the current history entry so the back button
 * does not return here, and sends the browser somewhere unremarkable.
 *
 * It cannot clear browser history — no web page can. It buys the few seconds
 * that matter. Pair it with the shared-computer session work in the audit.
 *
 * REDESIGN NOTE: keep this reachable on every screen and operable by keyboard.
 * Convention is bottom-right or top-right, always visible, never behind a menu.
 */
const NEUTRAL_DESTINATION = "https://www.google.com/search?q=weather";

export function QuickExit({ variant = "floating" }: { variant?: "floating" | "inline" } = {}) {
  const leave = () => {
    try {
      // Open a neutral page in this tab, replacing history so Back does not return.
      window.location.replace(NEUTRAL_DESTINATION);
    } catch {
      window.location.href = NEUTRAL_DESTINATION;
    }
  };

  return (
    <button
      type="button"
      onClick={leave}
      aria-label="Quickly leave this site"
      title="Quickly leave this site"
      className={
        variant === "inline"
          ? "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
          : // Floating, above the tab bar. Hidden on desktop, where it lives in
            // the header instead of covering the page.
            "fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-4 z-40 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-xs font-semibold text-white shadow-lg hover:opacity-90 lg:hidden"
      }
    >
      <LogOut className="size-3.5" />
      Quick exit
    </button>
  );
}
