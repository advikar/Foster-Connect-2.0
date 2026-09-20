/**
 * Always-available crisis contacts.
 *
 * These are hardcoded on purpose. Every other resource in Foster Guide comes
 * from the database, which means it disappears if the database is unreachable,
 * the AI provider is down, or a query fails. These do not. They are compiled
 * into both the API and the frontend bundle so that a young person in crisis
 * always has a number on screen, even when everything else is broken.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BEFORE LAUNCH: call every number below and confirm it connects, confirm the
 * hours are still accurate, and confirm the service still serves this audience.
 * Re-verify on a schedule (quarterly is reasonable) and update `verifiedOn`.
 * Do not let this file go stale — a wrong number here is worse than no app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CrisisCategory =
  | "suicide"
  | "abuse"
  | "trafficking"
  | "homeless_tonight"
  | "violence"
  | "general";

export interface CrisisContact {
  id: string;
  name: string;
  /** Dial string. Kept human-readable; strip non-digits for tel: links. */
  phone: string;
  /** Optional SMS instructions, e.g. text HOME to 741741 */
  text?: string;
  website?: string;
  /** What this line is for, in the young person's words. */
  description: string;
  hours: string;
  /** Which situations this contact should surface for. */
  categories: CrisisCategory[];
  /** Set to the date a human last confirmed this number by calling it. */
  verifiedOn: string;
}

export const CRISIS_CONTACTS: CrisisContact[] = [
  {
    id: "988",
    name: "988 Suicide & Crisis Lifeline",
    phone: "988",
    text: "Text 988",
    website: "https://988lifeline.org",
    description:
      "Free and confidential support if you are thinking about suicide, in emotional distress, or just need someone to talk to. Call or text.",
    hours: "24 hours, every day",
    categories: ["suicide", "general"],
    verifiedOn: "UNVERIFIED",
  },
  {
    id: "crisis-text-line",
    name: "Crisis Text Line",
    phone: "",
    text: "Text HOME to 741741",
    website: "https://www.crisistextline.org",
    description:
      "Text with a trained crisis counselor if talking out loud is not an option right now.",
    hours: "24 hours, every day",
    categories: ["suicide", "abuse", "violence", "general"],
    verifiedOn: "UNVERIFIED",
  },
  {
    id: "runaway-safeline",
    name: "National Runaway Safeline",
    phone: "1-800-786-2929",
    text: "Text 66008",
    website: "https://www.1800runaway.org",
    description:
      "For young people who have run away, been kicked out, or have nowhere to sleep tonight. They can help with shelter and transport home if you want it.",
    hours: "24 hours, every day",
    categories: ["homeless_tonight", "abuse", "general"],
    verifiedOn: "UNVERIFIED",
  },
  {
    id: "childhelp",
    name: "Childhelp National Child Abuse Hotline",
    phone: "1-800-422-4453",
    website: "https://www.childhelphotline.org",
    description:
      "Call or text if someone is hurting you, or you are not sure whether what is happening to you counts. You can ask questions without giving your name.",
    hours: "24 hours, every day",
    categories: ["abuse", "violence"],
    verifiedOn: "UNVERIFIED",
  },
  {
    id: "trafficking",
    name: "National Human Trafficking Hotline",
    phone: "1-888-373-7888",
    text: "Text 233733",
    website: "https://humantraffickinghotline.org",
    description:
      "If someone is making you work, have sex, or do anything you do not want to do — including someone who says they are helping you.",
    hours: "24 hours, every day",
    categories: ["trafficking", "violence"],
    verifiedOn: "UNVERIFIED",
  },
  {
    id: "ca-youth-crisis",
    name: "California Youth Crisis Line",
    phone: "1-800-843-5200",
    text: "Text 20121",
    website: "https://calyouth.org/cycl/",
    description:
      "California-specific support and referrals for youth ages 12–24 and their families.",
    hours: "24 hours, every day",
    categories: ["general", "homeless_tonight", "abuse", "suicide"],
    verifiedOn: "UNVERIFIED",
  },
];

/** Contacts to show for a given situation, most relevant first, never empty. */
export function contactsFor(categories: CrisisCategory[]): CrisisContact[] {
  const wanted = categories.length ? categories : ["general" as CrisisCategory];
  const scored = CRISIS_CONTACTS.map(contact => ({
    contact,
    score: contact.categories.filter(category => wanted.includes(category)).length,
  }));
  const matched = scored
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.contact);
  if (matched.length) return matched.slice(0, 4);
  return CRISIS_CONTACTS.filter(contact => contact.categories.includes("general")).slice(0, 4);
}

/**
 * What Nova says when a message is routed to crisis support.
 *
 * These are deterministic and never generated by the model — the model is not
 * in the loop on this path at all. Written to acknowledge the person without
 * dramatising, and to make clear that reaching out is their choice.
 */
export const CRISIS_REPLIES: Record<CrisisCategory, string> = {
  suicide:
    "Thank you for telling me that. What you are feeling matters, and you should not have to carry it by yourself. I am not a person and I cannot sit with you through this, but the people below can, right now — by phone or by text, and you do not have to give your name. If you are in immediate danger, call 911.",
  abuse:
    "I am glad you said something. What you are describing is not okay and it is not your fault. You can talk to someone about it below without giving your name, and you can ask them questions before deciding to do anything. If you are in immediate danger, call 911.",
  trafficking:
    "Thank you for telling me. What you are describing is serious, and there are people who help with exactly this — confidentially, and without needing your name. If you are in immediate danger, call 911.",
  homeless_tonight:
    "Somewhere safe to sleep tonight comes first — everything else can wait until tomorrow. The lines below help young people find a bed the same night, and they answer around the clock. I have also pulled any verified housing options I have for your area.",
  violence:
    "Your safety comes first. If you can get somewhere with other people around, do that. If you are in immediate danger, call 911. The people below can help you think through what to do next, confidentially.",
  general:
    "It sounds like a lot is happening right now. The lines below are free, confidential, and answer 24 hours a day — you can call or text them without giving your name.",
};

/** Gentle line appended when a message is concerning but not clearly a crisis. */
export const CONCERN_NOTE =
  "Also — if things ever feel heavier than this, 988 is free to call or text, any hour, and you do not have to be in a crisis to use it.";
