import { useState } from "react";
import { Phone, ShieldAlert, X } from "lucide-react";
import { CRISIS_CONTACTS, dialString } from "@/lib/crisis";

/**
 * Always-available crisis access.
 *
 * Renders from a compiled-in constant. No API call, no database, no AI, no
 * session. If the rest of the app is broken, this still works.
 *
 * REDESIGN: moved from a permanent full-width red bar into a calm, small
 * "Need help now" button that lives in the header on every screen. A
 * permanent red bar becomes invisible through repetition and frames the
 * whole app around crisis (principle 4). The full-width red bar is kept
 * only on the error page and the 404 (see ErrorFallback.tsx).
 */
export function CrisisButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-crisis-soft hover:text-crisis"
      >
        <ShieldAlert className="size-3.5" />
        Need help now
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-dismiss; the close button and Escape (browser default within a fixed overlay) remain fully keyboard-operable
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-ink/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Crisis support lines"
          onClick={event => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">Someone is available right now</h2>
                <p className="mt-1 text-sm text-ink-faint">
                  All of these are free and confidential. You do not have to give your name.
                  If you are in immediate danger, call 911.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close crisis support"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-sunk"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="mt-5 space-y-3">
              {CRISIS_CONTACTS.map(contact => (
                <li key={contact.id} className="rounded-xl border border-rule p-4">
                  <p className="font-semibold text-ink">{contact.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{contact.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {contact.phone && (
                      <a
                        href={`tel:${dialString(contact.phone)}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-crisis px-3 py-2 font-semibold text-white"
                      >
                        <Phone className="size-3.5" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.text && <span className="font-medium text-ink-soft">{contact.text}</span>}
                    <span className="text-xs text-ink-faint">{contact.hours}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
