import { CRISIS_CONTACTS, dialString } from "@/lib/crisis";

/**
 * Shown when a route throws, or when a URL does not exist.
 *
 * The previous behaviour was a blank white screen. For an app whose value is
 * being reachable at a hard moment, that is the worst possible failure. This
 * page renders from compiled-in constants only, so it works even when the API,
 * the database, and the AI are all unreachable.
 *
 * This is the one place that keeps the full-width crisis bar from Phase 1 —
 * everywhere else it moved to a calm header button (see CrisisBar.tsx).
 */
export function ErrorFallback({
  title = "Something on our side broke",
  detail = "This is our problem, not yours. Your saved journey and resources are safe.",
}: {
  title?: string;
  detail?: string;
}) {
  const urgent = CRISIS_CONTACTS.filter(contact => ["988", "runaway-safeline"].includes(contact.id));

  return (
    <div className="min-h-screen bg-ground">
      <div className="w-full border-b border-crisis/25 bg-crisis-soft px-4 py-2 text-center text-sm text-ink">
        <span>In crisis or not safe? </span>
        <a href="tel:988" className="font-semibold text-crisis underline underline-offset-2">Call or text 988</a>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-37px)] max-w-xl flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-ink-soft">{detail}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/" className="min-h-11 rounded-xl bg-brand px-5 py-3 font-semibold text-white">
            Go back to the start
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-xl border border-rule px-5 py-3 font-semibold text-ink-soft"
          >
            Try again
          </button>
        </div>

        <div className="mt-10 rounded-2xl border border-crisis/25 bg-crisis-soft p-5">
          <p className="font-semibold text-ink">If you need help right now, this still works:</p>
          <ul className="mt-3 space-y-2">
            {urgent.map(contact => (
              <li key={contact.id} className="text-sm text-ink">
                <span className="font-semibold">{contact.name}</span>{" "}
                {contact.phone && (
                  <a href={`tel:${dialString(contact.phone)}`} className="text-crisis underline underline-offset-2">
                    {contact.phone}
                  </a>
                )}
                {contact.text && <span> &middot; {contact.text}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">If you are in immediate danger, call 911.</p>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorFallback
      title="That page does not exist"
      detail="The link may be old or mistyped. Everything else is still here."
    />
  );
}
