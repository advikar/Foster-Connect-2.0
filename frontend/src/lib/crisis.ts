/**
 * Crisis contacts, compiled into the frontend bundle.
 *
 * These are duplicated from backend/src/config/crisis.ts on purpose. If the API
 * is unreachable, the database is down, or the young person is offline, these
 * still render. Nothing on this path makes a network request.
 *
 * KEEP IN SYNC with backend/src/config/crisis.ts, and re-verify every number
 * by calling it before launch. See the header comment in that file.
 */

export interface CrisisContact {
  id: string;
  name: string;
  phone: string;
  text?: string;
  website?: string;
  description: string;
  hours: string;
}

export const CRISIS_CONTACTS: CrisisContact[] = [
  {
    id: "988",
    name: "988 Suicide & Crisis Lifeline",
    phone: "988",
    text: "Text 988",
    website: "https://988lifeline.org",
    description:
      "Free and confidential support if you are thinking about suicide, in emotional distress, or just need someone to talk to.",
    hours: "24 hours, every day",
  },
  {
    id: "crisis-text-line",
    name: "Crisis Text Line",
    phone: "",
    text: "Text HOME to 741741",
    website: "https://www.crisistextline.org",
    description: "Text with a trained crisis counselor if talking out loud is not an option right now.",
    hours: "24 hours, every day",
  },
  {
    id: "runaway-safeline",
    name: "National Runaway Safeline",
    phone: "1-800-786-2929",
    text: "Text 1-800-786-2929",
    website: "https://www.1800runaway.org",
    description: "For young people who have run away, been kicked out, or have nowhere to sleep tonight.",
    hours: "24 hours, every day",
  },
  {
    id: "childhelp",
    name: "Childhelp National Child Abuse Hotline",
    phone: "1-800-422-4453",
    website: "https://www.childhelphotline.org",
    description: "Call or text if someone is hurting you, or you are not sure whether what is happening counts.",
    hours: "24 hours, every day",
  },
  {
    id: "trafficking",
    name: "National Human Trafficking Hotline",
    phone: "1-888-373-7888",
    text: "Text 233733",
    website: "https://humantraffickinghotline.org",
    description: "If someone is making you work, have sex, or do anything you do not want to do.",
    hours: "24 hours, every day",
  },
  {
    id: "ca-youth-crisis",
    name: "California Youth Crisis Line",
    phone: "1-800-843-5200",
    text: "Call or text 1-800-843-5200",
    website: "https://calyouth.org/cycl/",
    description: "California support and referrals for youth ages 12 to 24 and their families.",
    hours: "24 hours, every day",
  },
];

/** Digits only, for tel: links. */
export function dialString(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}
