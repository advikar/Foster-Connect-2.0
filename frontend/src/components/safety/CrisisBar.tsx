import { useState } from "react";
import { MessageSquare, Phone, ShieldAlert, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CRISIS_CONTACTS, dialString } from "@/lib/crisis";
import { contactActions, smsHref } from "@/lib/contactActions";

/**
 * Always-available crisis access.
 *
 * Renders from a compiled-in constant. No API call, no database, no AI, no
 * session. If the rest of the app is broken, this still works.
 *
 * The dialog is Radix's (audit A07): focus moves inside on open, Tab stays
 * inside, Escape and the backdrop close it, and focus returns to the trigger.
 * Text lines are real sms: links, not styled spans (audit A01).
 */
export function CrisisButton() {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Need help now: crisis lines"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[14px] font-semibold text-crisis transition-colors hover:bg-crisis-soft lg:min-h-11 lg:px-3"
        >
          <ShieldAlert className="size-[18px] lg:size-4" />
          <span className="hidden lg:inline">Need help now</span>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* `m-auto` on the card (not `items-center` here): a centred flex child taller than a scroll container has its top clipped. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[110] flex overflow-y-auto bg-brand-deep/55 p-4">
          <DialogPrimitive.Content className="m-auto w-full max-w-[640px] rounded-lg bg-ground p-6 shadow-2xl outline-none sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <DialogPrimitive.Title className="font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">Someone is available right now.</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  Free to call or text. You don&rsquo;t have to give your name. These lines keep what you say private, with limits if someone is in immediate danger. If you are in immediate danger, call 911.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Close crisis support"
                className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>

            <ul className="mt-4 divide-y divide-rule">
              {CRISIS_CONTACTS.map(contact => {
                const text = contact.text ? contactActions(contact.text).text : undefined;
                return (
                  <li key={contact.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                    <div>
                      <p className="text-[17px] font-semibold text-ink">{contact.name}</p>
                      <p className="mt-0.5 text-[14px] text-ink-soft">{contact.description}</p>
                      <p className="mt-1 text-[12px] text-ink-faint">{contact.hours}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {contact.phone && (
                        <a
                          href={`tel:${dialString(contact.phone)}`}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-crisis px-4 text-[16px] font-semibold text-white hover:opacity-90"
                        >
                          <Phone className="size-4" />
                          {contact.phone}
                        </a>
                      )}
                      {text && (
                        <a
                          href={smsHref(text.number, text.keyword)}
                          className={contact.phone
                            ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface"
                            : "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-crisis px-4 text-[16px] font-semibold text-white hover:opacity-90"}
                        >
                          <MessageSquare className="size-4" />
                          {text.label}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[12px] text-ink-faint">These numbers work even if the rest of the site is down.</p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
