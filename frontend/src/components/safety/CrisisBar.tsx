import { useEffect, useState } from "react";
import { Phone, ShieldAlert, X } from "lucide-react";
import { CRISIS_CONTACTS, dialString } from "@/lib/crisis";

/**
 * Always-available crisis access.
 *
 * Renders from a compiled-in constant. No API call, no database, no AI, no
 * session. If the rest of the app is broken, this still works.
 *
 * A calm rust text button in the header (icon-only on phones), opening a
 * dialog that lists every line with a real tel: button.
 */
export function CrisisButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Need help now: crisis lines"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[14px] font-semibold text-crisis transition-colors hover:bg-crisis-soft lg:min-h-11 lg:px-3"
      >
        <ShieldAlert className="size-[18px] lg:size-4" />
        <span className="hidden lg:inline">Need help now</span>
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-dismiss; the close button and Escape remain keyboard-operable
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-brand-deep/55 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Crisis support lines"
          onClick={event => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-[640px] rounded-lg bg-ground p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">Someone is available right now.</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  All free, all confidential. You don&rsquo;t have to give your name. If you&rsquo;re in immediate danger, call 911.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close crisis support"
                className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"
              >
                <X className="size-5" />
              </button>
            </div>

            <ul className="mt-4 divide-y divide-rule">
              {CRISIS_CONTACTS.map(contact => (
                <li key={contact.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                  <div>
                    <p className="text-[17px] font-semibold text-ink">{contact.name}</p>
                    <p className="mt-0.5 text-[14px] text-ink-soft">{contact.description}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {contact.hours}
                      {contact.text ? ` · ${contact.text}` : ""}
                    </p>
                  </div>
                  {contact.phone ? (
                    <a
                      href={`tel:${dialString(contact.phone)}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-crisis px-4 text-[16px] font-semibold text-white hover:opacity-90"
                    >
                      <Phone className="size-4" />
                      {contact.phone}
                    </a>
                  ) : contact.text ? (
                    <span className="inline-flex min-h-12 items-center justify-center rounded-md border border-ink px-4 text-[15px] font-semibold text-ink">{contact.text}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-faint">These numbers work even if the rest of the site is down.</p>
          </div>
        </div>
      )}
    </>
  );
}
