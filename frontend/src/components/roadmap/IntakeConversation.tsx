import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/primitives/Chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentId, HousingStatus, RoadmapIntake } from "@/lib/api";

/**
 * Intake, as a conversation rather than a form.
 *
 * Nova asks one thing at a time. Most answers are a tap, so this is faster
 * than the three-step form it replaces while collecting far more of what
 * actually determines a useful plan: where they are sleeping, which
 * documents they hold, and what has a date on it.
 *
 * Free-text answers are the ones that can contain a disclosure. The caller
 * submits them to the API, which runs the safety module over every field and
 * can return a deferred response — see RoadmapPage.
 */

const NEEDS = [
  "Housing", "Financial Support", "Education", "Employment",
  "Healthcare", "Mental Health", "Food Assistance", "Transportation",
];
const NEED_LABELS: Record<string, string> = {
  Housing: "Need a place to stay",
  "Financial Support": "Money or benefits",
  Education: "School, college or training",
  Employment: "Finding a job",
  Healthcare: "Health care",
  "Mental Health": "Mental health / someone to talk to",
  "Food Assistance": "Food",
  Transportation: "Transportation",
};

const HOUSING: { id: HousingStatus; label: string }[] = [
  { id: "placement", label: "A foster placement" },
  { id: "doubled_up", label: "With friends or family" },
  { id: "own_place", label: "My own place" },
  { id: "shelter", label: "Shelter or transitional" },
  { id: "unsheltered", label: "A car, or outside" },
  { id: "unstable", label: "It changes a lot" },
];

const DOCUMENTS: { id: DocumentId; label: string; detail: string }[] = [
  { id: "state_id", label: "State ID or license", detail: "A California ID card or driver's license that hasn't expired." },
  { id: "birth_certificate", label: "Birth certificate", detail: "The official (certified) copy from the county or state where you were born, not a photo of it. If you're in care, your worker is supposed to help you get one." },
  { id: "ssn_card", label: "Social Security card", detail: "The paper card itself. Replacements are free from the Social Security office." },
  { id: "bank_account", label: "Bank account", detail: "A checking or savings account in your own name." },
  { id: "phone_plan", label: "Phone plan in my name", detail: "A phone number you'll still have next month, so programs can reach you." },
];

const DEADLINES = [
  "Extended Foster Care ending", "A court date", "A school deadline", "My lease ending",
];

/** "Bay Area" stays a stored region but is not offered here: a county pick already includes regional listings. */
const COUNTIES: RoadmapIntake["county"][] = ["Alameda", "Contra Costa", "California", "National"];

interface Answers {
  needs: string[];
  housingStatus: HousingStatus;
  documents: DocumentId[];
  /** Whether the documents question was answered at all; skipping means "unknown", not "has none" (audit A10). */
  documentsAnswered: boolean;
  deadlines: { kind: string; date?: string }[];
  futurePlan: string;
  county: RoadmapIntake["county"] | "";
  age: string;
  youthName: string;
  /** "Something else…" free text per chip question (Y7). Sent to the model as additional context. */
  other: { needs: string; housing: string; documents: string; deadlines: string };
}

const EMPTY: Answers = {
  needs: [], housingStatus: "unsaid", documents: [], documentsAnswered: false, deadlines: [],
  futurePlan: "", county: "", age: "", youthName: "",
  other: { needs: "", housing: "", documents: "", deadlines: "" },
};

const NOT_SURE = "Not sure yet";

export function IntakeConversation({
  onSubmit, building, onCancel,
}: { onSubmit: (input: RoadmapIntake) => void; building: boolean; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each new question so screen reader users hear it.
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers(previous => ({ ...previous, [key]: value }));

  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter(item => item !== value) : [...list, value];
  const setOther = (key: keyof Answers["other"], value: string) =>
    setAnswers(previous => ({ ...previous, other: { ...previous.other, [key]: value } }));

  const steps = [
    {
      question: "What's going on right now?",
      hint: "Pick as many as fit. Most people pick more than one.",
      valid: answers.needs.length > 0 || answers.other.needs.trim().length >= 3,
      body: (
        <div>
          <div className="flex flex-wrap gap-2">
            {NEEDS.map(need => (
              <Chip
                key={need}
                selected={answers.needs.includes(need)}
                onClick={() => set("needs", toggle(answers.needs, need))}
              >
                {NEED_LABELS[need]}
              </Chip>
            ))}
          </div>
          <OtherText value={answers.other.needs} onChange={value => setOther("needs", value)} placeholder="e.g. my phone got cut off, or I need a lawyer for a ticket" />
        </div>
      ),
    },
    {
      question: "Where are you staying right now?",
      hint: "This changes what I can actually suggest. Skip it if you'd rather not say.",
      valid: true,
      body: (
        <div>
          <div className="flex flex-wrap gap-2">
            {HOUSING.map(option => (
              <Chip
                key={option.id}
                selected={answers.housingStatus === option.id}
                onClick={() => set("housingStatus", answers.housingStatus === option.id ? "unsaid" : option.id)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
          <OtherText value={answers.other.housing} onChange={value => setOther("housing", value)} placeholder="e.g. I can stay here until the end of the month" />
        </div>
      ),
    },
    {
      question: "Which of these do you have?",
      hint: "Most programs ask for one or more of these. Tell me what you have and I'll put getting the rest early in the plan. Skip it and I'll leave documents as a thing to check.",
      valid: true,
      body: (
        <div className="space-y-2">
          {DOCUMENTS.map(document => {
            const has = answers.documents.includes(document.id);
            return (
              <button
                key={document.id}
                type="button"
                aria-pressed={has}
                onClick={() => setAnswers(previous => ({ ...previous, documents: toggle(previous.documents, document.id), documentsAnswered: true }))}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-[16px] font-medium transition-colors ${
                  has ? "border-ink bg-sand-soft text-ink" : "border-rule bg-surface text-ink-soft"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                    has ? "border-brand bg-brand text-white" : "border-rule"
                  }`}
                >
                  {has && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span>{document.label}</span>
                  <span className="text-[13px] font-normal leading-snug text-ink-faint">{document.detail}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={answers.documentsAnswered && answers.documents.length === 0}
            onClick={() => setAnswers(previous => ({ ...previous, documents: [], documentsAnswered: true }))}
            className={`flex min-h-[52px] w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-[16px] font-medium transition-colors ${
              answers.documentsAnswered && answers.documents.length === 0 ? "border-ink bg-sand-soft text-ink" : "border-rule bg-surface text-ink-soft"
            }`}
          >
            <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded border ${answers.documentsAnswered && answers.documents.length === 0 ? "border-brand bg-brand text-white" : "border-rule"}`}>
              {answers.documentsAnswered && answers.documents.length === 0 && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="flex flex-col gap-0.5"><span>None of these yet</span><span className="text-[13px] font-normal leading-snug text-ink-faint">Getting them will go near the top of the plan.</span></span>
          </button>
          <OtherText value={answers.other.documents} onChange={value => setOther("documents", value)} placeholder="e.g. my ID is expired, or my birth certificate is with my old foster mom" />
        </div>
      ),
    },
    {
      question: "Anything coming up with a date on it?",
      hint: "Deadlines are what make a plan concrete instead of vague.",
      valid: true,
      body: (
        <div className="flex flex-wrap gap-2">
          {DEADLINES.map(kind => {
            const selected = answers.deadlines.some(deadline => deadline.kind === kind);
            return (
              <Chip
                key={kind}
                selected={selected}
                onClick={() =>
                  set(
                    "deadlines",
                    selected
                      ? answers.deadlines.filter(deadline => deadline.kind !== kind)
                      : [...answers.deadlines, { kind }],
                  )
                }
              >
                {kind}
              </Chip>
            );
          })}
          <Chip selected={answers.deadlines.length === 0} onClick={() => set("deadlines", [])}>
            Nothing right now
          </Chip>
          <div className="basis-full">
            <OtherText value={answers.other.deadlines} onChange={value => setOther("deadlines", value)} placeholder="e.g. rent is due on the 1st, or my job starts in two weeks" />
          </div>
        </div>
      ),
    },
    {
      question: "What would you want to be different in six months?",
      hint: "However you'd say it. It doesn't have to be impressive or figured out. \"Not sure yet\" is a real answer — the plan starts with the basics then.",
      valid: answers.futurePlan.trim().length >= 3,
      body: (
        <div className="space-y-3">
          <Textarea
            value={answers.futurePlan}
            onChange={event => set("futurePlan", event.target.value)}
            placeholder="my own place, and back in school"
            className="min-h-28 rounded-md border-rule bg-surface text-base"
            aria-label="What would you want to be different in six months?"
          />
          <Chip selected={answers.futurePlan === NOT_SURE} onClick={() => set("futurePlan", answers.futurePlan === NOT_SURE ? "" : NOT_SURE)}>
            I&rsquo;m not sure yet
          </Chip>
        </div>
      ),
    },
    {
      question: "Last thing — where should I look?",
      hint: "Name and age are optional, and only used to filter out things you can't get.",
      valid: Boolean(answers.county),
      body: (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {COUNTIES.map(county => (
              <Chip key={county} selected={answers.county === county} onClick={() => set("county", county)}>
                {county}
              </Chip>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabelledInput label="What should I call you?" optional value={answers.youthName} onChange={value => set("youthName", value)} />
            <LabelledInput label="Age" optional type="number" value={answers.age} onChange={value => set("age", value)} />
          </div>
          {answers.age !== "" && Number(answers.age) < 14 && (
            <p className="text-[14px] text-ink-soft">Planning for a child? That works: the steps will be written for the adult helping them, using programs open at that age.</p>
          )}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const submit = () => {
    const needsSummary = [
      answers.needs.map(need => NEED_LABELS[need] || need).join(", "),
      answers.housingStatus !== "unsaid"
        ? `Staying: ${HOUSING.find(option => option.id === answers.housingStatus)?.label}`
        : "",
    ].filter(Boolean).join(". ");

    const inTheirWords = [
      answers.other.needs && `What's going on, in their words: ${answers.other.needs.trim()}`,
      answers.other.housing && `About where they're staying: ${answers.other.housing.trim()}`,
      answers.other.documents && `About documents: ${answers.other.documents.trim()}`,
      answers.other.deadlines && `About dates: ${answers.other.deadlines.trim()}`,
      answers.futurePlan === NOT_SURE && "They are not sure what they want in six months; start with stability and documents, and keep the plan short.",
    ].filter(Boolean).join("\n");

    onSubmit({
      youthName: answers.youthName || undefined,
      age: answers.age ? Number(answers.age) : undefined,
      county: answers.county as RoadmapIntake["county"],
      currentNeeds: [needsSummary, answers.other.needs.trim()].filter(Boolean).join(". ") || "Figuring things out",
      futurePlan: answers.futurePlan,
      additionalContext: inTheirWords || undefined,
      needs: answers.needs,
      housingStatus: answers.housingStatus,
      documents: answers.documentsAnswered ? answers.documents : undefined,
      deadlines: answers.deadlines,
    });
  };

  return (
    <div className="container-wide"><div className="flex min-h-[calc(100vh-260px)] max-w-[760px] flex-col pb-10 pt-6 lg:min-h-0 lg:pt-14">
      {onCancel && (
        <button type="button" onClick={onCancel} className="mb-4 inline-flex min-h-9 items-center gap-1.5 self-start text-[14px] text-brand hover:underline">
          <ArrowLeft className="size-4" /> Back to my current plan
        </button>
      )}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(value => value - 1)}
            className="-ml-2 flex size-11 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"
            aria-label="Back to the previous question"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Question ${step + 1} of ${steps.length}`}
        >
          {steps.map((_, index) => (
            <span key={index} className={`h-1 flex-1 rounded-sm transition-colors ${index <= step ? "bg-brand" : "bg-rule"}`} />
          ))}
        </div>
      </div>

      <div className="mt-8 flex-1 lg:flex-none">
        <p className="text-eyebrow text-brand">Question {step + 1} of {steps.length}</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-display-sm mt-2 max-w-[18ch] text-ink outline-none lg:text-[40px]">
          {current.question}
        </h1>
        <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">{current.hint}</p>
        <div className="mt-7">{current.body}</div>
      </div>

      {/* Sits above the fixed tab bar on phones. */}
      <div className="sticky bottom-[80px] mt-10 bg-ground pt-4 lg:static lg:mt-12 lg:max-w-[320px]">
        <Button
          type="button"
          disabled={!current.valid || building}
          onClick={() => (isLast ? submit() : setStep(value => value + 1))}
          className="min-h-[52px] w-full rounded-md bg-brand text-base font-semibold text-white hover:bg-brand-deep"
        >
          {building && <Loader2 className="size-4 animate-spin" />}
          {building ? "Putting it together" : isLast ? "Build my plan" : "Next"}
        </Button>
        {!current.valid && !building && <p className="mt-2 text-[13px] text-ink-faint">Pick one or more to continue.</p>}
      </div>
    </div></div>
  );
}

/** A quiet "Something else…" that opens a short free-text field under a chip question (Y7). */
function OtherText({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(Boolean(value));
  const id = useId();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-9 items-center text-[14px] font-medium text-brand hover:underline">
        + Something else, in your own words
      </button>
    );
  }
  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">In your own words <span className="font-normal text-ink-faint">(optional)</span></label>
      <Textarea id={id} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} maxLength={400} className="mt-1.5 min-h-20 rounded-md border-rule bg-surface text-base" />
    </div>
  );
}

function LabelledInput({
  label, value, onChange, optional, type = "text",
}: { label: string; value: string; onChange: (value: string) => void; optional?: boolean; type?: string }) {
  const id = `intake-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(optional)</span>}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1.5 h-12 rounded-md border-rule bg-surface text-base"
      />
    </div>
  );
}
