/**
 * Outbound email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * No SDK: one fetch. Unconfigured (no RESEND_API_KEY) means every send returns
 * false and callers fall back to the manual, reviewer-driven path, so the app
 * never depends on mail to work.
 *
 * Env: RESEND_API_KEY, MAIL_FROM ("Foster Guide <noreply@fosterguide.org>", a
 * domain verified in Resend), SITE_URL (https://fosterguide.org), and
 * NOTIFY_EMAIL (where new-account notices go).
 */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function siteUrl() {
  return (process.env.SITE_URL || "https://fosterguide.org").replace(/\/$/, "");
}

export async function sendMail(to: string, subject: string, text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!response.ok) {
      console.error("Mail provider refused the message", { status: response.status, body: (await response.text()).slice(0, 300) });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Mail provider unreachable", error);
    return false;
  }
}

export function resetEmail(link: string) {
  return {
    subject: "Reset your Foster Guide partner password",
    text: `Someone asked to reset the password for this Foster Guide partner account.\n\nOpen this link to choose a new password (it works once and expires in 48 hours):\n${link}\n\nIf you did not ask for this, ignore this message; nothing changes.\n\nFoster Guide is a directory, not legal advice. ${siteUrl()}`,
  };
}

export function newAccountEmail(account: { name: string; email: string; organisation: string }) {
  return {
    subject: `New Foster Guide partner account: ${account.organisation}`,
    text: `${account.name} (${account.email}) created a contributor account for "${account.organisation}".\n\nSee every account, and promote or reset, at ${siteUrl()}/partners/accounts`,
  };
}
