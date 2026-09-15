import test from "node:test";
import assert from "node:assert/strict";
import {
  generateGroundedRoadmap, groundRoadmapDraft, getNavigatorResponse, getPartnerGuideResponse,
  type GroundedResource, type RoadmapInput, type RoadmapDraft,
} from "./ai.service";

/**
 * FC-02: the roadmap must never contain a program, phone number, or link that
 * was not in the resources we handed the model, and a configured-but-broken
 * provider must produce the deterministic plan instead of a 500.
 *
 * The provider is mocked by replacing global fetch. No network, no real key,
 * no youth data. Fixtures are synthetic.
 */

const resource = (id: number, overrides: Partial<GroundedResource> = {}): GroundedResource => ({
  id, title: `Resource ${id}`, organization: `Org ${id}`, description: "Synthetic fixture",
  category: "Housing", county: "Alameda", serviceArea: "Alameda", eligibility: "Foster youth 16-24",
  ageMin: 16, ageMax: 24, cost: "Free", applicationSteps: "Call", whatToBring: "ID",
  website: `https://org${id}.example.org`, phone: `510-555-01${String(id).padStart(2, "0")}`,
  address: "", hours: "9-5", languages: "English", accessibility: "", deliveryMode: "In person",
  urgencyLevel: "standard", isCrisis: false, sourceUrl: "", verifiedAt: "2026-01-01", tags: "",
  ...overrides,
});

const RESOURCES = [resource(1), resource(2), resource(3)];

const INPUT: RoadmapInput = {
  youthName: "Sam", age: 19, county: "Alameda",
  currentNeeds: "I need a stable place to live and a job",
  futurePlan: "finish my associate degree",
  additionalContext: "None provided",
  needs: ["Housing", "Employment"], housingStatus: "doubled_up", documents: ["state_id"], deadlines: [],
};

const task = (overrides: Partial<RoadmapDraft["tasks"][number]> = {}): RoadmapDraft["tasks"][number] => ({
  taskText: "Call Org 1 and ask to be assigned a coordinator. About 10 minutes.",
  taskCategory: "Housing", timeframe: "This Week",
  whyItMatters: "A coordinator is the person who can actually move things.",
  motivationNote: "One call.", resourceId: 1, ...overrides,
});

const validDraft = (): RoadmapDraft => ({
  title: "Toward a stable place",
  goalSummary: "Steps toward housing and work.",
  greeting: "Here is what I put together.",
  closing: "This is yours to change.",
  tasks: [task(), task({ resourceId: 2 }), task({ resourceId: 3 }), task({ resourceId: null, taskText: "Put your documents in one folder." }), task({ resourceId: null, taskText: "Set a reminder for two weeks out." })],
  recommendedResourceIds: [1, 2],
});

// ─── fetch mocking ──────────────────────────────────────────────────────────

type FetchImpl = typeof globalThis.fetch;
const realFetch = globalThis.fetch;
let calls = 0;

function withProvider(impl: (call: number) => Promise<Response>, fn: () => Promise<void>) {
  return async () => {
    calls = 0;
    process.env.LLM_API_KEY = "test-key-not-real";
    globalThis.fetch = (async () => impl(++calls)) as FetchImpl;
    try { await fn(); } finally {
      globalThis.fetch = realFetch;
      delete process.env.LLM_API_KEY;
    }
  };
}

const jsonReply = (payload: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200 });

// ─── Provider failure paths ─────────────────────────────────────────────────

test("provider HTTP 500 falls back to the deterministic plan, labelled", withProvider(
  async () => new Response("upstream exploded", { status: 500 }),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
    assert.match(roadmap.fallbackReason || "", /500/);
    assert.ok(roadmap.tasks.length >= 4);
    assert.equal(calls, 1, "a 5xx is not retried through the JSON-repair path");
  },
));

test("provider timeout falls back instead of throwing", withProvider(
  async () => { throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); },
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
    assert.match(roadmap.fallbackReason || "", /timeout/i);
  },
));

test("malformed JSON is repaired once, then falls back", withProvider(
  async () => new Response(JSON.stringify({ choices: [{ message: { content: "{not json" } }] }), { status: 200 }),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
    assert.equal(calls, 2, "one repair attempt, then give up");
  },
));

test("schema-invalid JSON (missing tasks) falls back after one repair", withProvider(
  async () => jsonReply({ title: "x", goalSummary: "y" }),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
    assert.equal(calls, 2);
  },
));

test("empty provider body falls back", withProvider(
  async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
  },
));

test("missing API key is fallback, and never touches the network", async () => {
  delete process.env.LLM_API_KEY;
  globalThis.fetch = (async () => { throw new Error("network must not be called"); }) as FetchImpl;
  try {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
  } finally { globalThis.fetch = realFetch; }
});

// ─── Grounding of a syntactically valid draft ───────────────────────────────

test("a clean draft passes through labelled as ai", withProvider(
  async () => jsonReply(validDraft()),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "ai");
    assert.equal(roadmap.tasks.length, 5);
    assert.deepEqual(roadmap.groundingRemoved, []);
  },
));

test("a task naming a resourceId we never supplied is dropped, not nulled", () => {
  const draft = validDraft();
  draft.tasks.push(task({ resourceId: 999, taskText: "Call Sunrise Youth Housing and ask for a bed." }));
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.equal(result.roadmap.tasks.length, 5);
  assert.ok(!result.roadmap.tasks.some(t => t.taskText.includes("Sunrise")));
  assert.ok(result.removed.some(r => r.includes("999")));
});

test("a null-id task containing an invented phone number is dropped", () => {
  const draft = validDraft();
  draft.tasks.push(task({ resourceId: null, taskText: "Call the housing hotline at 415-555-0000 and ask about beds." }));
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.ok(!result.roadmap.tasks.some(t => t.taskText.includes("415")));
});

test("a task with an invented URL in whyItMatters is dropped", () => {
  const draft = validDraft();
  draft.tasks.push(task({ resourceId: null, whyItMatters: "Apply at www.fake-grants-for-youth.com before Friday." }));
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.ok(!result.roadmap.tasks.some(t => t.whyItMatters.includes("fake-grants")));
});

test("a task quoting a phone number that IS in the resources is kept", () => {
  const draft = validDraft();
  draft.tasks[0] = task({ taskText: "Call Org 1 at 510-555-0101 and ask for a coordinator." });
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.ok(result.roadmap.tasks[0].taskText.includes("510-555-0101"));
});

test("crisis line numbers are always allowed in roadmap text", () => {
  const draft = validDraft();
  draft.closing = "If tonight gets hard, call or text 988.";
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.ok(result.roadmap.closing.includes("988"));
});

test("greeting and closing are sanitised, not dropped", () => {
  const draft = validDraft();
  draft.greeting = "You can also try 925-555-9999 for extra help.";
  draft.closing = "See https://totally-made-up.org for more.";
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.ok(!result.roadmap.greeting.includes("925-555-9999"));
  assert.ok(!result.roadmap.closing.includes("totally-made-up"));
  assert.equal(result.removed.length, 2);
});

test("recommendedResourceIds are filtered to supplied resources", () => {
  const draft = validDraft();
  draft.recommendedResourceIds = [1, 42, 2, 2];
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.deepEqual(result.roadmap.recommendedResourceIds, [1, 2]);
});

test("a draft where most tasks are fabricated is rejected and falls back", withProvider(
  async () => jsonReply({
    ...validDraft(),
    tasks: [
      task({ resourceId: 901 }), task({ resourceId: 902 }), task({ resourceId: 903 }),
      task({ resourceId: null, taskText: "Call 415-555-0000." }), task(),
    ],
  }),
  async () => {
    const roadmap = await generateGroundedRoadmap(INPUT, RESOURCES);
    assert.equal(roadmap.generatedBy, "fallback");
    assert.match(roadmap.fallbackReason || "", /survived grounding/);
    assert.ok(roadmap.groundingRemoved.length >= 4);
  },
));

test("resource IDs written into task text are removed and the task is kept", () => {
  const draft = validDraft();
  draft.tasks[0] = task({ taskText: "Call Resource 1 (1) and ask for a coordinator.", whyItMatters: "They run the program (ID 1)." });
  draft.greeting = "I picked Resource 2 [2] for you.";
  const result = groundRoadmapDraft(draft, RESOURCES);
  assert.ok(result.roadmap);
  assert.equal(result.roadmap.tasks.length, 5);
  assert.equal(result.roadmap.tasks[0].taskText, "Call Resource 1 and ask for a coordinator.");
  assert.equal(result.roadmap.tasks[0].whyItMatters, "They run the program.");
  assert.equal(result.roadmap.greeting, "I picked Resource 2 for you.");
});

// ─── Navigator suggested tasks ──────────────────────────────────────────────

test("navigator suggested tasks with unknown resource IDs are dropped", withProvider(
  async () => jsonReply({
    reply: "Here are two options.",
    resourceIds: [1, 777],
    needsClarification: false,
    suggestedTasks: [
      { taskText: "Call Org 1", taskCategory: "Housing", timeframe: "This Week", resourceId: 1, motivationNote: "" },
      { taskText: "Call Fake Org", taskCategory: "Housing", timeframe: "This Week", resourceId: 777, motivationNote: "" },
    ],
  }),
  async () => {
    const result = await getNavigatorResponse("housing?", [], RESOURCES);
    assert.deepEqual(result.resourceIds, [1]);
    assert.equal(result.suggestedTasks.length, 1);
    assert.equal(result.suggestedTasks[0].resourceId, 1);
  },
));

test("navigator reply and suggested tasks have resource IDs removed", withProvider(
  async () => jsonReply({
    reply: "Try Resource 3 (3). They can help.",
    resourceIds: [3],
    needsClarification: false,
    suggestedTasks: [
      { taskText: "Call Resource 3 (ID 3) this week", taskCategory: "Housing", timeframe: "This Week", resourceId: 3, motivationNote: "One call (3)." },
    ],
  }),
  async () => {
    const result = await getNavigatorResponse("housing?", [], RESOURCES);
    assert.equal(result.reply, "Try Resource 3. They can help.");
    assert.equal(result.suggestedTasks[0].taskText, "Call Resource 3 this week");
    assert.equal(result.suggestedTasks[0].motivationNote, "One call.");
  },
));

test("navigator reply markdown is flattened to plain text", withProvider(
  async () => jsonReply({ reply: "Try **Resource 3**. It is `free`.", resourceIds: [3], needsClarification: false, suggestedTasks: [] }),
  async () => {
    const result = await getNavigatorResponse("housing?", [], RESOURCES);
    assert.equal(result.reply, "Try Resource 3. It is free.");
  },
));

// ─── Conversation memory ────────────────────────────────────────────────────

async function captureRequestMessages(run: () => Promise<unknown>) {
  let sent: { role: string; content: string }[] = [];
  process.env.LLM_API_KEY = "test-key-not-real";
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body)).messages;
    return jsonReply({ reply: "ok", resourceIds: [], needsClarification: false, suggestedTasks: [] });
  }) as FetchImpl;
  try { await run(); } finally {
    globalThis.fetch = realFetch;
    delete process.env.LLM_API_KEY;
  }
  return sent;
}

test("navigator sends the earlier turns of the conversation to the model", async () => {
  const history = [
    { role: "user" as const, content: "My name is Jordan and I need a bus pass" },
    { role: "assistant" as const, content: "Alameda CTC has a youth pass." },
  ];
  const sent = await captureRequestMessages(() => getNavigatorResponse("what was my name?", history, RESOURCES));
  assert.equal(sent[0].role, "system");
  assert.deepEqual(sent.slice(1, 3), history);
  assert.deepEqual(sent.at(-1), { role: "user", content: "what was my name?" });
});

test("partner guide sends the earlier turns of the conversation to the model", async () => {
  const history = [
    { role: "user" as const, content: "Help me outline a transportation resource." },
    { role: "assistant" as const, content: "Start with who it serves." },
  ];
  const sent = await captureRequestMessages(() => getPartnerGuideResponse("what did you say to start with?", RESOURCES, history));
  assert.deepEqual(sent.slice(1, 3), history);
  assert.deepEqual(sent.at(-1), { role: "user", content: "what did you say to start with?" });
});

// ─── Plan suggestions (Y3) ───────────────────────────────────────────────────

test("plan suggestions keep only actionable ones: listed resources, real task ids, required fields", withProvider(
  async () => jsonReply({
    reply: "You could add that.", resourceIds: [1], needsClarification: false, suggestedTasks: [],
    planSuggestions: [
      { action: "add", taskText: "Call Org 1 and ask about intake (1)", resourceId: 1, timeframe: "This Week", why: "It is listed." },
      { action: "add", taskText: "Get a state ID", resourceId: 777, timeframe: "This Week" },
      { action: "remove", targetTaskId: 999 },
      { action: "split", targetTaskId: 43, steps: ["Gather your ID", "Call them", "Visit on Monday"] },
    ],
  }),
  async () => {
    const plan = { id: 7, tasks: [
      { id: 42, taskText: "Get a state ID", timeframe: "This Week", status: "not_started" },
      { id: 43, taskText: "Apply for housing", timeframe: "30 Days", status: "not_started" },
    ] };
    const result = await getNavigatorResponse("can you add that?", [], RESOURCES, plan);
    const actions = result.planSuggestions.map(item => `${item.action}:${item.targetTaskId ?? item.taskText}`);
    // The duplicate of an existing step and the unknown task id are dropped; the resource id is stripped from the text.
    assert.deepEqual(actions, ["add:Call Org 1 and ask about intake", "split:43"]);
    assert.equal(result.planSuggestions[0].resourceId, 1, "listed resource kept");
    assert.deepEqual(result.planSuggestions[1].steps, ["Gather your ID", "Call them", "Visit on Monday"]);
  },
));

test("plan suggestions are empty when the model returns none", withProvider(
  async () => jsonReply({ reply: "ok", resourceIds: [], needsClarification: false, suggestedTasks: [] }),
  async () => {
    const result = await getNavigatorResponse("hi", [], RESOURCES, null);
    assert.deepEqual(result.planSuggestions, []);
  },
));
