import type { CrisisCategory } from "../config/crisis";

/**
 * Safety triage for anything a young person types into Foster Guide.
 *
 * Design notes, because the details here matter more than the code:
 *
 * 1. NORMALIZE FIRST. Young people in crisis frequently use terms that exist
 *    specifically to evade filters ("kms", "unalive"), plus typos, missing
 *    apostrophes, accents, and letter-stretching. Matching raw text misses all
 *    of it. Everything below runs against a normalized string.
 *
 * 2. CATEGORIES, NOT A BOOLEAN. "I want to die" and "I have nowhere to sleep
 *    tonight" are both urgent and need completely different answers. Routing a
 *    homeless youth to a suicide line is its own kind of failure.
 *
 * 3. TWO TIERS. `crisis` interrupts and leads with help. `concern` does not
 *    interrupt — the person still gets the answer they asked for, with a quiet
 *    line offering support. Treating every mention of sadness as an emergency
 *    teaches people to stop telling you things.
 *
 * 4. FALSE POSITIVES ARE CHEAPER THAN FALSE NEGATIVES, but not free. Figurative
 *    speech is filtered explicitly rather than by making patterns narrower.
 *
 * This is a safety net, not a diagnosis. It runs before the model and never
 * depends on it.
 */

export type SafetyLevel = "none" | "concern" | "crisis";

export interface SafetyAssessment {
  level: SafetyLevel;
  categories: CrisisCategory[];
  /** Normalized text that was matched — for logging and test output only. */
  normalized: string;
}

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

/**
 * Fold text down to something patterns can reliably match:
 * lowercase, accents removed, leetspeak expanded, filter-evading punctuation
 * inside words stripped ("k.m.s" -> "kms"), stretched letters collapsed
 * ("noooo" -> "noo"), contractions normalized, whitespace collapsed.
 */
export function normalize(input: string): string {
  let text = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  text = text.replace(/[013457@$!]/g, character => LEET[character] ?? character);

  // Strip separators used between letters to break up words: k.m.s / k*m*s / k_m_s
  text = text.replace(/(?<=[a-z])[.\-_*+/\\|]+(?=[a-z])/g, "");

  // Normalize apostrophes then drop them: don't / don´t / dont -> dont
  text = text.replace(/['‘’ʼ`]/g, "");

  // Collapse 3+ repeated letters to 2: soooo -> soo
  text = text.replace(/([a-z])\1{2,}/g, "$1$1");

  // Remaining punctuation becomes spaces so word boundaries stay reliable.
  text = text.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Figurative uses that must never, on their own, route someone to a crisis line.
 *
 * These are REMOVED from the text before the rules run (see `stripFigurative`),
 * not used as a whole-message early return. A message can contain an idiom and
 * a real disclosure in the same breath: "I'm dying to get this job. I want to
 * kill myself tonight." Bailing out on the first idiom silenced the second half.
 *
 * Each pattern is global so every occurrence is removed.
 */
const FIGURATIVE: RegExp[] = [
  /\b(dying|dyin) to\b/g,                          // "dying to get this job"
  /\bkill(ing)? (it|time|the vibe)\b/g,
  /\bdead (tired|serious|end|line|weight)\b/g,
  /\bto die for\b/g,
  /\bkill(ed|s|ing)? (my|the) (battery|phone|charger|vibe|mood)\b/g,
  /\bsuicide (squad|prevention (class|training|month|week)|awareness)\b/g,
  /\bhomework is killing me\b/g,
  // "my mom will kill me if I fail" — only an idiom when a consequence clause
  // follows. A bare "my mom will kill me" is left in place and handled below.
  /\b(my )?(foster )?(dad|mom|mother|father|parent)s? (would|will|might|is going to|is gonna|s gonna|gonna) kill me\b(?=.*\b(if|when|for|because|cause|cuz|bc|over|about|once)\b)/g,
];

/**
 * A parent/caregiver "kill me" phrase with no consequence clause. Not an idiom
 * we can rule out, not a disclosure we can confirm. Surfaces as `concern` so
 * the person gets a quiet offer of support rather than either silence or an
 * interruption. If the message also contains a real danger signal (a weapon,
 * "hits me"), the crisis rules catch that independently.
 */
const BARE_PARENT_THREAT =
  /\b(my )?(foster )?(dad|mom|mother|father|parent)s? (would|will|might|is going to|is gonna|s gonna|gonna) kill me\b/;

/** Remove every figurative span so the remaining text can be assessed alone. */
function stripFigurative(text: string): string {
  let stripped = text;
  for (const pattern of FIGURATIVE) {
    pattern.lastIndex = 0;
    stripped = stripped.replace(pattern, " ");
  }
  return stripped.replace(/\s+/g, " ").trim();
}

interface Rule {
  category: CrisisCategory;
  level: SafetyLevel;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    category: "suicide",
    level: "crisis",
    patterns: [
      /\bkill(ing)? my ?self\b/,
      /\bkms\b/,
      /\bsuicid(e|al)\b/,
      /\bunalive\b/,
      /\bend(ing)? (my|it|this|things) (life|all)?\b/,
      /\bend (my life|it all|things|it)\b/,
      /\btake (my own life|my life)\b/,
      /\b(want|wanna|going|gonna) to (die+|be dead)\b/,
      /\bi (want|wanna) (to )?die+\b/,
      /\bwish i (was|were) (dead|never born)\b/,
      /\bdont want to (be here|live|wake up|exist|be alive|keep going)\b/,
      /\bdont wanna (be here|live|wake up|exist|be alive)\b/,
      /\bbetter off without me\b/,
      /\b(no|nothing) (reason|left) to live\b/,
      /\bnothing to live for\b/,
      /\bhurt(ing)? my ?self\b/,
      /\bharm(ing)? my ?self\b/,
      /\bself harm\b/,
      /\b(been|start|started|keep|kept) cutting\b(?!.*\b(hair|class|corners?|coupons?|onions?|paper|nails|the (grass|lawn|cake)|back on)\b)/,
      /\bcut(ting)? my ?self\b/,
      /\bcut my ?self\b/,
      /\boverdos(e|ing)\b/,
      /\bthinking about ending it\b/,
      /\bthis is (my last|goodbye)\b/,
      // Spanish
      /\bsuicid(arme|io|a)\b/,
      /\bquiero morir(me)?\b/,
      /\bmatarme\b/,
      /\bno quiero (vivir|estar aqui)\b/,
      /\bhacerme dano\b/,
    ],
  },
  {
    category: "abuse",
    level: "crisis",
    patterns: [
      /\b(hits|hit|beats|beat|beating|punch(es|ed)?|slaps?|slapped|chok(es|ed)|burn(s|ed)) me\b/,
      /\b(touch(es|ed|ing)) me\b/,
      /\bmolest(ed|ing|s)?\b/,
      /\b(raped?|raping)\b/,
      /\b(abus(es|ed|ing)) me\b/,
      /\bbeing abused\b/,
      /\b(scared|afraid|terrified) (of|to go) (my |back )?(home|house|foster|dad|mom|mother|father|placement|him|her)\b/,
      /\bdont feel safe (at|in) (home|the house|my placement)\b/,
      /\bnot safe (at|in) (home|the house|my placement)\b/,
      /\b(wont|will not) let me (leave|out|go)\b/,
      /\block(s|ed) me (in|up|out)\b/,
      /\bthreaten(s|ed|ing) me\b/,
      // Spanish
      /\bme (pega|pegan|golpea|lastima|toca)\b/,
      /\babuso (sexual|fisico)\b/,
    ],
  },
  {
    category: "trafficking",
    level: "crisis",
    patterns: [
      /\btraffick(ed|ing)\b/,
      /\bmaking me (do (stuff|things)|sleep with|have sex|work)\b/,
      /\bmakes me (do (stuff|things)|sleep with|have sex)\b/,
      /\bforc(es|ed|ing) me to (work|have sex|sleep with|do)\b/,
      /\bsell(ing|s)? me\b/,
      /\bfor money\b(?=.*\b(guy|man|men|do stuff|do things|sleep|sex)\b)/,
      /\b(my )?pimp\b/,
    ],
  },
  {
    category: "violence",
    level: "crisis",
    patterns: [
      /\b(im|i am|feel|feeling) not safe\b/,
      /\bim not safe\b/,
      /\bnot safe right now\b/,
      /\bimmediate danger\b/,
      /\bin danger\b/,
      /\b(going|gonna) to (kill|hurt) me\b/,
      /\bthreatening to (kill|hurt)\b/,
      /\b(following|chasing|stalking) me\b/,
      /\bhas a (gun|knife|weapon)\b/,
      // Spanish
      /\bno estoy segur[oa]\b/,
      /\bestoy en peligro\b/,
    ],
  },
  {
    category: "homeless_tonight",
    level: "crisis",
    patterns: [
      /\bno ?where to (go|stay|sleep|live)\b/,
      /\bnot? (place|somewhere|anywhere) to (stay|sleep|go)\b/,
      /\b(got |been |was )?(kicked|thrown|put) out\b/,
      /\bsleeping (in my car|outside|on the street|in a park|rough|at the bus)\b/,
      /\b(im|i am) (sleeping|staying) (in my car|outside|on the street)\b/,
      /\bon the streets?\b/,
      /\bhomeless\b(?=.*\b(tonight|now|right now|today)\b)/,
      // Spanish
      /\bno tengo (donde|adonde) (ir|dormir|quedarme)\b/,
    ],
  },
];

/** Needing a bed *tonight* specifically — combination rule, not a single phrase. */
const TONIGHT = /\b(tonight|2night|tonite|right now|today|this ?night)\b/;
const NEEDS_BED = /\b(place|somewhere|anywhere|spot|bed|room|couch)\b.{0,20}\b(to )?(stay|sleep|crash)\b|\b(stay|sleep|crash)\b.{0,20}\b(tonight|somewhere|anywhere)\b|\bneed (a )?(shelter|bed)\b/;

/** Means + intent, which no single keyword catches. */
const MEANS = /\b(pills|rope|gun|blade|razor|bridge|overdose|bleach)\b/;
const INTENT = /\b(plan|ready|tonight|decided|going to|gonna|about to)\b/;

/** Lower-confidence distress. Never interrupts; only adds a gentle offer. */
const CONCERN_PATTERNS: RegExp[] = [
  /\b(cant|can not) (do this|go on|take (it|this)|keep going) (anymore|any more)?\b/,
  /\bi give up\b/,
  /\bwhats the point\b/,
  /\bno ?body (would|will) ?(even |really )?(notice|care)\b/,
  /\bno ?one (cares|would care)\b/,
  /\b(so |really )?tired of (living|everything|all of this|being alive)\b/,
  /\bfeel(ing)? (hopeless|worthless|empty|numb|like a burden)\b/,
  /\bim a burden\b/,
  /\bhate my ?self\b/,
  /\bcant stop crying\b/,
  /\bnothing matters\b/,
];

/**
 * Assess a message. Never throws — a thrown error here would mean a young
 * person in crisis gets a 500 instead of a phone number.
 */
export function assessSafety(input: string): SafetyAssessment {
  try {
    const normalized = normalize(input || "");
    if (!normalized) return { level: "none", categories: [], normalized: "" };

    // Idioms are cut out, not used to dismiss the whole message.
    const text = stripFigurative(normalized);
    if (!text) return { level: "none", categories: [], normalized };

    const categories = new Set<CrisisCategory>();

    for (const rule of RULES) {
      if (rule.patterns.some(pattern => pattern.test(text))) {
        categories.add(rule.category);
      }
    }

    // Combination: needs a bed, and needs it tonight.
    if (NEEDS_BED.test(text) && TONIGHT.test(text)) {
      categories.add("homeless_tonight");
    }

    // Combination: named a method plus intent, without saying a trigger word.
    if (MEANS.test(text) && INTENT.test(text)) {
      categories.add("suicide");
    }

    if (categories.size > 0) {
      return { level: "crisis", categories: [...categories], normalized };
    }

    if (CONCERN_PATTERNS.some(pattern => pattern.test(text)) || BARE_PARENT_THREAT.test(text)) {
      return { level: "concern", categories: ["general"], normalized };
    }

    return { level: "none", categories: [], normalized };
  } catch {
    // If triage itself fails, fail toward showing help.
    return { level: "concern", categories: ["general"], normalized: "" };
  }
}

/** Convenience for the roadmap intake, which has several free-text fields. */
export function assessFields(...fields: (string | undefined)[]): SafetyAssessment {
  const assessments = fields
    .filter((field): field is string => Boolean(field))
    .map(assessSafety);
  const crisis = assessments.find(assessment => assessment.level === "crisis");
  if (crisis) {
    const categories = new Set<CrisisCategory>();
    assessments.forEach(assessment => {
      if (assessment.level === "crisis") assessment.categories.forEach(c => categories.add(c));
    });
    return { ...crisis, categories: [...categories] };
  }
  return (
    assessments.find(assessment => assessment.level === "concern") || {
      level: "none",
      categories: [],
      normalized: "",
    }
  );
}
