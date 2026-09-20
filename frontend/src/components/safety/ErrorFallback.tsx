import { Link } from "react-router-dom";
import { CRISIS_CONTACTS, dialString } from "@/lib/crisis";

/**
 * Shown when a route throws, or when a URL does not exist.
 *
 * The previous behaviour was a blank white screen. For an app whose value is
 * being reachable at a hard moment, that is the worst possible failure. This
 * page renders from compiled-in constants only, so it works even when the API,
 * the database, and the AI are all unreachable.
 *
 * ErrorFallback replaces the whole shell (the layout itself may be what
 * broke), so it carries its own crisis strip. NotFoundPage renders inside the
 * shell, whose footer already prints the numbers.
 */
export function ErrorFallback({
  title = "Something on our side broke",
  detail = "This is our problem, not yours. Your saved journey and resources are safe.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="min-h-screen bg-ground">
      <div className="w-full border-b border-rule bg-crisis-soft px-5 py-2 text-center text-[14px] text-ink">
        <span>In crisis or not safe? </span>
        <a href="tel:988" className="font-semibold text-crisis underline underline-offset-2">Call or text 988</a>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-37px)] max-w-xl flex-col justify-center px-5 py-16">
        <Message title={title} detail={detail} home={<a href={import.meta.env.BASE_URL} className={primary}>Go back to the start</a>} />
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="container-wide">
      <div className="max-w-xl py-16 lg:py-24">
        <Message
          title="That page does not exist"
          detail="The link may be old or mistyped. Everything else is still here."
          home={<Link to="/" className={primary}>Go back to the start</Link>}
        />
      </div>
    </div>
  );
}

const primary = "inline-flex h-12 items-center rounded-md bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep";

function Message({ title, detail, home }: { title: string; detail: string; home: React.ReactNode }) {
  const urgent = CRISIS_CONTACTS.filter(contact => ["988", "runaway-safeline"].includes(contact.id));

  return (
    <>
      <p className="text-eyebrow text-brand">Foster Guide</p>
      <h1 className="text-display-sm mt-2 text-ink">{title}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">{detail}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {home}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-12 items-center rounded-md border border-ink px-5 text-[15px] font-semibold text-ink hover:bg-surface"
        >
          Try again
        </button>
      </div>

      <section className="mt-10 border-t border-rule pt-6">
        <p className="text-eyebrow text-crisis">If you need help right now</p>
        <ul className="mt-3 divide-y divide-rule">
          {urgent.map(contact => (
            <li key={contact.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[15px] text-ink">
              <span className="font-semibold">{contact.name}</span>
              <span>
                {contact.phone && (
                  <a href={`tel:${dialString(contact.phone)}`} className="text-crisis underline underline-offset-2">
                    {contact.phone}
                  </a>
                )}
                {contact.text && <span className="text-ink-soft"> &middot; {contact.text}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-ink-faint">If you are in immediate danger, call 911.</p>
      </section>
    </>
  );
}
