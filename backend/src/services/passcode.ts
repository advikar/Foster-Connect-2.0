import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number }) => Promise<Buffer>;

/**
 * "Save this with a passcode" (Y6).
 *
 * A young person's data hangs off an anonymous session id kept in one
 * browser. A passcode lets the same session be opened on another device
 * (a caseworker's laptop, a new phone) without an email or an account.
 *
 * Storage model, so a leaked database gives away as little as possible:
 * - lookup  = HMAC-SHA256(server secret, normalised passcode). Finds the row
 *   without storing the passcode. Without the server secret a database copy
 *   cannot be searched by guessing passcodes.
 * - cipher  = AES-256-GCM(session id) under a key derived from the passcode
 *   with scrypt and a per-row salt. Even with the secret, each row costs a
 *   scrypt run per guess.
 * The passcode itself is never stored and cannot be recovered or reset: a
 * forgotten passcode means opening the plan on a new device is not possible,
 * but the original device still has everything.
 */
export const PASSCODE_MIN = 8;

export function passcodeProblem(passcode: string): string | null {
  const trimmed = passcode.trim();
  if (trimmed.length < PASSCODE_MIN) return `Use at least ${PASSCODE_MIN} characters. A few words you will remember work best.`;
  if (trimmed.length > 120) return "That is longer than 120 characters.";
  if (/^(.)\1+$/.test(trimmed) || /^(0123456789|1234567890|12345678|password|qwertyui)/i.test(trimmed)) return "That one is too easy to guess. Try a few words that mean something to you.";
  return null;
}

/** Case and spacing should not lock someone out: "blue bike 2019" == "Blue  Bike 2019". */
export function normalisePasscode(passcode: string) {
  return passcode.trim().toLowerCase().replace(/\s+/g, " ");
}

export function passcodeLookup(secret: string, passcode: string) {
  return crypto.createHmac("sha256", secret).update(normalisePasscode(passcode)).digest("hex");
}

export interface SealedSession { salt: string; iv: string; cipher: string; tag: string }

export async function sealSession(passcode: string, sessionId: string): Promise<SealedSession> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(normalisePasscode(passcode), salt, 32, { N: 16384 });
  const iv = crypto.randomBytes(12);
  const aes = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipher = Buffer.concat([aes.update(sessionId, "utf8"), aes.final()]);
  return { salt: salt.toString("hex"), iv: iv.toString("hex"), cipher: cipher.toString("hex"), tag: aes.getAuthTag().toString("hex") };
}

/** Returns the session id, or null when the passcode does not match this row. */
export async function openSession(passcode: string, sealed: SealedSession): Promise<string | null> {
  try {
    const key = await scrypt(normalisePasscode(passcode), Buffer.from(sealed.salt, "hex"), 32, { N: 16384 });
    const aes = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "hex"));
    aes.setAuthTag(Buffer.from(sealed.tag, "hex"));
    return Buffer.concat([aes.update(Buffer.from(sealed.cipher, "hex")), aes.final()]).toString("utf8");
  } catch {
    return null;
  }
}
