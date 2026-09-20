import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/**
 * Partner accounts.
 *
 * Replaces a single shared bearer token — the literal string
 * "demo-partner-access" — that everyone used. Approving a submission is the act
 * that puts information in front of a vulnerable young person, so it needs to
 * be attributable to a named person and revocable one account at a time.
 *
 * Passwords use scrypt from Node's own crypto, so this adds no dependency. Work
 * factor N=16384 is the Node default and is appropriate here; if you raise it,
 * raise it in verifyPassword too or existing hashes stop matching.
 *
 * Session tokens are random 32-byte values. Only their SHA-256 hash is stored,
 * so a leaked database does not hand over live sessions.
 */

const KEY_LENGTH = 64;
const SESSION_HOURS = 12;

export interface Partner {
  id: number;
  email: string;
  name: string;
  organisation: string;
  active: boolean;
  role: "contributor" | "reviewer";
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, salt, expected] = stored.split(":");
    if (scheme !== "scrypt" || !salt || !expected) return false;
    const derived = await scrypt(password, salt, KEY_LENGTH);
    const expectedBuffer = Buffer.from(expected, "hex");
    if (expectedBuffer.length !== derived.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

/** A session token, and the hash to store for it. */
export function newSessionToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: expiryTimestamp() };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function expiryTimestamp() {
  return new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * Password rules, kept deliberately simple: length does more for real-world
 * safety than a zoo of character-class requirements, which mostly produce
 * "Password1!" and a sticky note.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (/^\d+$/.test(password)) return "Use more than just numbers.";
  const common = ["password", "fosterguide", "fosterconnect", "letmein", "qwerty", "demo-partner-access"];
  if (common.some(bad => password.toLowerCase().includes(bad))) {
    return "That contains a word that is too easy to guess.";
  }
  return null;
}

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canReview(partner: Pick<Partner, "role">) { return partner.role === "reviewer"; }
