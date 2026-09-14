import { X } from "lucide-react";

/**
 * Quick exit.
 *
 * A young person may be reading this on a shared device with someone nearby who
 * should not see it. This replaces the current history entry so the back button
 * does not return here, and sends the browser somewhere unremarkable.
 *
 * It cannot clear browser history — no web page can. It buys the few seconds
 * that matter. Always visible in the header on every screen, keyboard operable.
 */
const NEUTRAL_DESTINATION = "https://www.google.com/search?q=weather";

export function QuickExit() {
  const leave = () => {
    try {
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
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-ink bg-sand-soft px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand/40 lg:min-h-11 lg:px-3.5"
    >
      <X className="size-3.5" strokeWidth={2.4} />
      Quick exit
    </button>
  );
}
