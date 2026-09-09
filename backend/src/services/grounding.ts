import crypto from "crypto";

/**
 * The two things that make Maya's "no invented programs, phone numbers, or
 * links" promise actually true.
 *
 * The app already strips resource IDs the model did not receive, and rehydrates
 * every link and phone number from SQLite after generation. That protects the
 * resource CARDS. It does nothing about Maya's prose — the model could write a
 * fabricated number mid-sentence and it would go straight to a young person
 * under a badge claiming the opposite. This module closes both holes.
 *
 * 1. HISTORY SIGNING. The browser sends the conversation back on every turn,
 *    including what Maya supposedly said. Anyone can edit that, which is the
 *    standard way these guardrails get broken: forge an assistant turn saying
 *    the rules changed, and the model plays along.
 *
 *    We sign it instead of storing it. A server-side chat table would also fix
 *    forgery, but it would mean persisting the most sensitive free text in the
 *    product — and the privacy page promises chat is not saved. Signing keeps
 *    that promise and still makes forgery impossible.
 *
 * 2. REPLY SANITISATION. Any phone number or link in Maya's prose that was not
 *    in the data she was given is removed before it reaches the person.
 */

// ─── History signing ────────────────────────────────────────────────────────

export interface SignedMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Signing key. Set CHAT_SIGNING_SECRET in production so tokens survive a
 * restart and are consistent across instances. Without it we generate one per
 * process, which is safe but invalidates in-flight conversations on deploy —
 * the failure mode is a dropped history, never a crash or a leak.
 */
const SIGNING_SECRET =
  process.env.CHAT_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.CHAT_SIGNING_SECRET && process.env.NODE_ENV === "production") {
  // Same policy as DATABASE_URL: a production deploy missing a required secret
  // should fail loudly at boot, not degrade quietly after the first restart.
  console.error(
    "CHAT_SIGNING_SECRET is not set. Refusing to start in production; see docs/DEPLOY.md.",
  );
  process.exit(1);
}

function canonical(sessionId: string, messages: SignedMessage[]) {
  return JSON.stringify({
    sessionId,
    messages: messages.map(message => [message.role, message.content]),
  });
}

export function signHistory(sessionId: string, messages: SignedMessage[]): string {
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(canonical(sessionId, messages))
    .digest("base64url");
}

/**
 * Returns the history only if the token proves this server produced it.
 * A bad, missing, or tampered token drops the history rather than throwing —
 * losing conversational context is a much better outcome for the person in
 * front of the screen than an error page.
 */
export function verifyHistory(
  sessionId: string,
  messages: SignedMessage[],
  token: string | undefined,
): { trusted: boolean; messages: SignedMessage[] } {
  if (!token || !messages.length) return { trusted: !messages.length, messages: [] };

  const expected = signHistory(sessionId, messages);
  const provided = Buffer.from(token, "utf8");
  const wanted = Buffer.from(expected, "utf8");

  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    return { trusted: false, messages: [] };
  }
  return { trusted: true, messages };
}

// ─── Reply sanitisation ─────────────────────────────────────────────────────

/** Contact details Maya is allowed to say out loud. */
export interface AllowedContacts {
  /** Last 10 digits of every permitted phone number. */
  phoneDigits: Set<string>;
  /** Permitted hostnames, lowercased, without "www.". */
  hosts: Set<string>;
}

export function buildAllowList(
  resources: { phone?: string; website?: string; sourceUrl?: string }[],
  crisisContacts: { phone?: string; text?: string; website?: string }[] = [],
): AllowedContacts {
  const phoneDigits = new Set<string>();
  const hosts = new Set<string>();

  const addPhone = (value?: string) => {
    if (!value) return;
    // A single field can hold several numbers, e.g. "(925) 496-7743, x2".
    for (const match of value.matchAll(/\d[\d\s().-]{6,}\d/g)) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length >= 3) phoneDigits.add(digits.slice(-10));
    }
    // Short codes and three-digit lines: 988, 741741, 911.
    const bare = value.replace(/\D/g, "");
    if (bare.length >= 3 && bare.length <= 6) phoneDigits.add(bare);
  };

  const addHost = (value?: string) => {
    if (!value) return;
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value}`);
      hosts.add(url.hostname.toLowerCase().replace(/^www\./, ""));
    } catch {
      /* not a URL; ignore */
    }
  };

  for (const resource of resources) {
    addPhone(resource.phone);
    addHost(resource.website);
    addHost(resource.sourceUrl);
  }
  for (const contact of crisisContacts) {
    addPhone(contact.phone);
    addPhone(contact.text);
    addHost(contact.website);
  }

  // Emergency services are always sayable.
  ["911", "988"].forEach(number => phoneDigits.add(number));

  return { phoneDigits, hosts };
}

const PHONE_PATTERN =
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{6}\b|\b\d{3}\b(?=\s*(?:hotline|line|lifeline)|\s*$)/gi;
const URL_PATTERN = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,)]*)?/gi;

/** Words that look like domains but are ordinary prose. */
const NOT_A_DOMAIN = /^(?:e\.g|i\.e|etc|vs|a\.m|p\.m|u\.s|approx)\.?$/i;

export interface SanitisedReply {
  reply: string;
  /** Anything removed, for logging. Never shown to the person. */
  removed: string[];
}

/**
 * Remove contact details Maya was not given.
 *
 * Replaced rather than deleted, so the sentence still reads, and the person is
 * pointed at the verified card instead of a number we cannot stand behind.
 */
export function sanitiseReply(reply: string, allowed: AllowedContacts): SanitisedReply {
  const removed: string[] = [];
  let output = reply;

  output = output.replace(PHONE_PATTERN, match => {
    const digits = match.replace(/\D/g, "");
    const key = digits.length > 10 ? digits.slice(-10) : digits;
    if (allowed.phoneDigits.has(key) || allowed.phoneDigits.has(digits)) return match;
    removed.push(match.trim());
    return "the number on their listing below";
  });

  output = output.replace(URL_PATTERN, match => {
    if (NOT_A_DOMAIN.test(match)) return match;
    let host: string;
    try {
      host = new URL(match.startsWith("http") ? match : `https://${match}`)
        .hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return match;
    }
    if (!host.includes(".")) return match;
    if (allowed.hosts.has(host)) return match;
    removed.push(match.trim());
    return "their official page, linked below";
  });

  return { reply: output, removed };
}
