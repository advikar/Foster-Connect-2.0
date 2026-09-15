import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePasscode, openSession, passcodeLookup, passcodeProblem, sealSession } from "./passcode";

test("a passcode opens what it sealed, and nothing else does", async () => {
  const sealed = await sealSession("blue bike 2019", "session-abc-123-def-456");
  assert.equal(await openSession("Blue  BIKE 2019", sealed), "session-abc-123-def-456");
  assert.equal(await openSession("blue bike 2018", sealed), null);
  assert.notEqual(sealed.cipher.includes("session"), true);
});

test("lookup depends on the secret and ignores case and spacing", () => {
  assert.equal(passcodeLookup("s1", "Blue Bike"), passcodeLookup("s1", " blue  bike "));
  assert.notEqual(passcodeLookup("s1", "blue bike"), passcodeLookup("s2", "blue bike"));
  assert.equal(normalisePasscode("  A   b "), "a b");
});

test("weak passcodes are refused with a reason", () => {
  assert.match(passcodeProblem("short")!, /at least 8/);
  assert.match(passcodeProblem("aaaaaaaaaa")!, /easy to guess/);
  assert.match(passcodeProblem("password1234")!, /easy to guess/);
  assert.equal(passcodeProblem("my dog is called max"), null);
});
