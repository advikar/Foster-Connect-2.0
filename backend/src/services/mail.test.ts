import assert from "node:assert/strict";
import { test } from "node:test";
import { mailConfigured, newAccountEmail, resetEmail, sendMail } from "./mail";

test("mail is off without a key and every send is a quiet false", async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal(mailConfigured(), false);
  assert.equal(await sendMail("a@example.org", "x", "y", async () => { throw new Error("must not be called"); }), false);
});

test("a configured send posts to Resend with the from address, and reports refusals as false", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM = "Foster Guide <noreply@example.org>";
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const ok = await sendMail("a@example.org", "Subject", "Body", (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  assert.equal(ok, true);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.deepEqual(calls[0].body, { from: "Foster Guide <noreply@example.org>", to: ["a@example.org"], subject: "Subject", text: "Body" });
  const refused = await sendMail("a@example.org", "s", "t", (async () => new Response("nope", { status: 403 })) as typeof fetch);
  assert.equal(refused, false);
  delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM;
});

test("reset and new-account emails carry the link and the account", () => {
  assert.match(resetEmail("https://x/partners/reset?token=abc").text, /token=abc/);
  const note = newAccountEmail({ name: "A", email: "a@example.org", organisation: "Org" });
  assert.match(note.subject, /Org/);
  assert.match(note.text, /a@example\.org/);
});
