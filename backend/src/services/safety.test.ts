import test from "node:test";
import assert from "node:assert/strict";
import { assessSafety, assessFields, normalize } from "./safety";
import type { CrisisCategory } from "../config/crisis";

/**
 * Crisis-routing test suite.
 *
 * RUN THIS BEFORE EVERY DEPLOY: `npm test` in backend/.
 *
 * When someone reports a phrase that was missed, add it here FIRST, watch it
 * fail, then widen the patterns until it passes. This file is the record of
 * every way we have learned that a young person might ask for help.
 */

type Case = [message: string, category: CrisisCategory];

const CRISIS_CASES: Case[] = [
  // -- Suicidal ideation: direct -------------------------------------------
  ["I want to kill myself", "suicide"],
  ["I'm suicidal", "suicide"],
  ["I want to end my life", "suicide"],
  ["I've been thinking about ending it", "suicide"],
  ["I want to die", "suicide"],
  ["I wish I was dead", "suicide"],
  ["I want to take my own life", "suicide"],

  // -- Suicidal ideation: indirect, which the old regex missed entirely -----
  ["I don't want to be here anymore", "suicide"],
  ["I don't want to wake up tomorrow", "suicide"],
  ["everyone would be better off without me", "suicide"],
  ["there's nothing to live for", "suicide"],

  // -- Filter-evading terms young people actually use ----------------------
  ["im gonna kms", "suicide"],
  ["I want to unalive myself", "suicide"],
  ["k.m.s", "suicide"],
  ["I want to k1ll myself", "suicide"],
  ["i wanna diee", "suicide"],

  // -- Self-harm -----------------------------------------------------------
  ["I'm going to hurt myself", "suicide"],
  ["I've been cutting again", "suicide"],
  ["I've been cutting", "suicide"],
  ["I keep cutting", "suicide"],
  ["I cut myself last night", "suicide"],

  // -- Means plus intent, with no trigger keyword --------------------------
  ["I have a plan and pills", "suicide"],
  ["I'm ready, I have the rope", "suicide"],

  // -- Abuse disclosure ----------------------------------------------------
  ["my foster dad hits me", "abuse"],
  ["my foster dad touches me", "abuse"],
  ["I'm scared of my foster parent", "abuse"],
  ["I don't feel safe at home", "abuse"],
  ["he won't let me leave the house", "abuse"],
  ["she locks me in my room", "abuse"],
  ["my placement threatens me", "abuse"],

  // -- Trafficking ---------------------------------------------------------
  ["I'm being trafficked", "trafficking"],
  ["a guy is making me do stuff for money", "trafficking"],
  ["he forced me to have sex with his friends", "trafficking"],

  // -- Immediate danger ----------------------------------------------------
  ["I'm not safe", "violence"],
  ["im not safe", "violence"],
  ["he's going to hurt me", "violence"],
  ["someone is following me", "violence"],
  ["he has a gun", "violence"],

  // -- Nowhere to sleep tonight --------------------------------------------
  ["I need somewhere to sleep tonight", "homeless_tonight"],
  ["I have nowhere to go tonight", "homeless_tonight"],
  ["I need a place to stay tonight", "homeless_tonight"],
  ["I'm sleeping in my car", "homeless_tonight"],
  ["I got kicked out today", "homeless_tonight"],
  ["I have nowhere to go", "homeless_tonight"],
  ["I need a shelter tonight", "homeless_tonight"],

  // -- Mixed messages: figurative idiom AND a real disclosure (FC-01) -------
  // The old code returned "none" for the whole message as soon as any idiom
  // matched, which silenced the disclosure that followed it.
  ["I am dying to get this job. I want to kill myself tonight.", "suicide"],
  ["My mom will kill me. She has a gun.", "violence"],
  ["homework is killing me and honestly I don't want to be here anymore", "suicide"],
  ["I'm dead serious, my foster dad hits me", "abuse"],
  ["dying to get out of here, I have nowhere to sleep tonight", "homeless_tonight"],
  ["this job would be to die for but my placement threatens me", "abuse"],

  // -- Spanish -------------------------------------------------------------
  ["estoy pensando en suicidarme", "suicide"],
  ["quiero morirme", "suicide"],
  ["mi papa me pega", "abuse"],
  ["no tengo donde dormir", "homeless_tonight"],
];

test("every crisis phrasing routes to crisis, in the right category", () => {
  const failures: string[] = [];
  for (const [message, expected] of CRISIS_CASES) {
    const result = assessSafety(message);
    if (result.level !== "crisis") {
      failures.push(`NOT CRISIS: ${JSON.stringify(message)} -> ${result.level}`);
    } else if (!result.categories.includes(expected)) {
      failures.push(
        `WRONG CATEGORY: ${JSON.stringify(message)} -> ${result.categories.join(",")} (wanted ${expected})`,
      );
    }
  }
  assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
});

const CONCERN_CASES = [
  "I can't do this anymore",
  "I give up",
  "what's the point",
  "nobody would even notice",
  "I'm so tired of everything",
  "I feel worthless",
  "I feel like a burden",
  "I hate myself",
];

test("distress without crisis indicators is concern, not crisis", () => {
  for (const message of CONCERN_CASES) {
    const result = assessSafety(message);
    assert.equal(result.level, "concern", `${JSON.stringify(message)} -> ${result.level}`);
  }
});

const ORDINARY_CASES = [
  "I need help finding a job",
  "how do I apply for financial aid",
  "I'm dying to get this internship",
  "my mom will kill me if I fail this class",
  "homework is killing me",
  "I want to go to nursing school",
  "where can I get a bus pass",
  "I need help getting my birth certificate",
  "I'm looking for housing for next semester",
  "can you help me write a resume",
  "I volunteered at a suicide prevention training",
  "what documents do I need for MediCal",
  "I've been cutting my hair myself to save money",
  "I've been cutting class a lot",
  "my dad would kill me for spending that much",
  "my foster mom is going to kill me when she sees my grades",
  "I'm dead tired but I need to find a job",
  // Audit A04: medication logistics are not self-harm intent.
  "I need to refill my pills tonight",
  "forgot to take my pills, can I get them tonight from the pharmacy",
];

test("a bare parental threat is a concern, not dismissed as an idiom", () => {
  // "my mom will kill me if I fail" is an idiom. "my mom will kill me" with
  // no consequence clause is ambiguous and must not be categorically harmless.
  // Audit A04: a consequence about *telling* is a threat, not an idiom.
  for (const message of ["my mom will kill me", "my foster dad would kill me", "My dad will kill me if I tell anyone", "my mom will kill me, she said that about my brother", "my dad is gonna kill me when he finds out I talked to you"]) {
    const result = assessSafety(message);
    assert.equal(result.level, "concern", `${JSON.stringify(message)} -> ${result.level}`);
  }
});

test("ordinary and figurative messages are not flagged", () => {
  const failures: string[] = [];
  for (const message of ORDINARY_CASES) {
    const result = assessSafety(message);
    if (result.level !== "none") {
      failures.push(`FALSE POSITIVE: ${JSON.stringify(message)} -> ${result.level} ${result.categories}`);
    }
  }
  assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
});

test("normalization folds evasion, accents, and stretching", () => {
  assert.equal(normalize("K.M.S"), "kms");
  assert.equal(normalize("Suicidarme"), "suicidarme");
  assert.equal(normalize("don't"), "dont");
  assert.equal(normalize("nooooo"), "noo");
  assert.equal(normalize("k1ll"), "kill");
  assert.equal(normalize("  spaced   out  "), "spaced out");
});

test("roadmap intake fields are all checked, not just the first", () => {
  const result = assessFields(
    "I want to find stable housing",
    "my foster dad hits me",
    undefined,
  );
  assert.equal(result.level, "crisis");
  assert.ok(result.categories.includes("abuse"));
});

test("assessment never throws on hostile input", () => {
  const inputs = ["", "   ", "...", " ", "a".repeat(50_000), "<script>alert(1)</script>"];
  for (const input of inputs) {
    assert.doesNotThrow(() => assessSafety(input), `threw on ${JSON.stringify(input.slice(0, 20))}`);
  }
});
