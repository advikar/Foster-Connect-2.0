/**
 * Turn a listing's free-text phone field into real actions (audit A01).
 *
 * The directory stores one string per listing. Most are ordinary numbers, but
 * crisis lines read "Text HOME to 741741", "Text SAFE and your location to
 * 44357", or "Call 211 or text HOPE to 20121". Stripping to digits and emitting
 * `tel:` produced a phone call to a text-only short code, or one invalid
 * number made of two destinations. This parser separates the channels.
 */
export interface ContactActions {
  call?: { number: string; label: string };
  text?: { number: string; keyword?: string; label: string };
}

const SHORT_CODE = /^\d{5,6}$/;

function digits(value: string) { return value.replace(/[^\d+]/g, ""); }

export function contactActions(raw: string | null | undefined): ContactActions {
  const source = (raw ?? "").trim();
  if (!source) return {};
  const out: ContactActions = {};

  // "text HOME to 741741" / "text SAFE and your location to 44357" / "text 988"
  const textMatch = source.match(/\btext(?:ing)?\s+(?:([A-Z][A-Z0-9]{1,15})(?:\s+and your location)?\s+to\s+)?([\d][\d\s().-]{2,}\d)/i);
  if (textMatch) {
    const number = digits(textMatch[2]);
    const keyword = textMatch[1] && !/^to$/i.test(textMatch[1]) ? textMatch[1].toUpperCase() : undefined;
    out.text = { number, keyword, label: keyword ? `Text ${keyword} to ${formatNumber(number)}` : `Text ${formatNumber(number)}` };
  }

  // Everything that is not the text instruction: "Call 211", a plain number, "1-800-…".
  const withoutText = textMatch ? source.replace(textMatch[0], " ") : source;
  const callMatch = withoutText.match(/(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{3}\b(?=\s*(?:$|[^\d-]))|\b988\b|\b211\b)/);
  if (callMatch) {
    const number = digits(callMatch[0]);
    if (number.length >= 3 && !SHORT_CODE.test(number)) out.call = { number, label: `Call ${formatNumber(number)}` };
  } else if (!textMatch) {
    // A bare short code with no verb: short codes are for texting, not calling.
    const bare = digits(source);
    if (SHORT_CODE.test(bare)) out.text = { number: bare, label: `Text ${bare}` };
    else if (/^\+?\d{7,}$/.test(bare)) out.call = { number: bare, label: `Call ${source}` };
  }
  return out;
}

/** sms: link that carries a keyword on both iOS and Android. */
export function smsHref(number: string, keyword?: string) {
  return keyword ? `sms:${number}?&body=${encodeURIComponent(keyword)}` : `sms:${number}`;
}

export function formatNumber(number: string) {
  const d = number.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
