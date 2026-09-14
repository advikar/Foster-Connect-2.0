import { useState } from "react";
import { Chip } from "@/components/primitives/Chip";
import { AGE_LABELS, CARE_LABELS, useAboutYou, type AboutCounty, type AgeBand, type CareStatus } from "@/hooks/useAboutYou";

const AGES: AgeBand[] = ["under18", "18-20", "21-24", "25plus", "unsaid"];
const COUNTIES: { id: AboutCounty; label: string }[] = [
  { id: "Alameda", label: "Alameda" }, { id: "Contra Costa", label: "Contra Costa" }, { id: "elsewhere", label: "Somewhere else" },
];
const CARE: CareStatus[] = ["in_care", "former", "unsure"];

/**
 * "Want this page to fit you?" — three optional taps, stored on this device.
 * Never sent anywhere. Once saved, the card collapses to one line with Change.
 */
export function AboutYouCard() {
  const { about, save, clear } = useAboutYou();
  const [editing, setEditing] = useState(false);
  const [age, setAge] = useState<AgeBand | "">(about?.age ?? "");
  const [county, setCounty] = useState<AboutCounty | "">(about?.county ?? "");
  const [care, setCare] = useState<CareStatus | "">(about?.care ?? "");

  if (about && !editing) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-rule py-3">
        <p className="text-eyebrow text-ink-faint">
          You said: {AGE_LABELS[about.age]}{about.county ? ` · ${about.county === "elsewhere" ? "Outside the two counties" : about.county}` : ""}{about.care ? ` · ${CARE_LABELS[about.care]}` : ""}
        </p>
        <div className="flex gap-4 text-[13px]">
          <button type="button" onClick={() => setEditing(true)} className="text-brand hover:underline">Change</button>
          <button type="button" onClick={() => { clear(); setAge(""); setCounty(""); setCare(""); }} className="text-ink-faint hover:underline">Forget</button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="about-you-heading" className="flex flex-col gap-4 rounded-md bg-sand-soft p-5 lg:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="about-you-heading" className="font-display text-[22px] font-bold text-ink">Want this page to fit you?</h2>
        {about && <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-brand hover:underline">Cancel</button>}
      </div>
      <p className="text-[15px] leading-relaxed text-ink-soft">Three taps. Stays on this device only — never sent anywhere, and you can forget it any time.</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink-soft">How old are you?</legend>
        <div className="flex flex-wrap gap-2">
          {AGES.map(band => <Chip key={band} selected={age === band} onClick={() => setAge(band)}>{AGE_LABELS[band]}</Chip>)}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink-soft">Which county?</legend>
        <div className="flex flex-wrap gap-2">
          {COUNTIES.map(option => <Chip key={option.id} selected={county === option.id} onClick={() => setCounty(county === option.id ? "" : option.id)}>{option.label}</Chip>)}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink-soft">Foster care</legend>
        <div className="flex flex-wrap gap-2">
          {CARE.map(status => <Chip key={status} selected={care === status} onClick={() => setCare(care === status ? "" : status)}>{CARE_LABELS[status]}</Chip>)}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!age}
        onClick={() => { if (age) { save({ age, county, care }); setEditing(false); } }}
        className="inline-flex min-h-11 items-center self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface disabled:opacity-40"
      >
        Save on this device
      </button>
    </section>
  );
}
