import { useState } from "react";
import { Link } from "react-router-dom";
import { Chip } from "@/components/primitives/Chip";
import { AGE_LABELS, useAboutYou, type AboutCounty, type AgeBand } from "@/hooks/useAboutYou";

const AGES: AgeBand[] = ["under18", "18-20", "21-24", "25plus", "unsaid"];
const COUNTIES: { id: AboutCounty; label: string }[] = [
  { id: "Alameda", label: "Alameda" }, { id: "Contra Costa", label: "Contra Costa" }, { id: "elsewhere", label: "Somewhere else" },
];

/**
 * "Your preferences" — two optional taps (age, county), stored on this device.
 * Filters may be used in resource requests. The form is collapsed by default.
 */
export function AboutYouCard() {
  const { about, save, clear } = useAboutYou();
  const [editing, setEditing] = useState(false);
  const [age, setAge] = useState<AgeBand | "">(about?.age ?? "");
  const [county, setCounty] = useState<AboutCounty | "">(about?.county ?? "");

  if (!about && !editing) {
    return (
      <section className="rounded-xl border border-rule bg-sand-soft p-5">
        <p className="font-semibold text-ink">Make this page relevant to you</p>
        <p className="mt-1 text-[15px] text-ink-soft">Choose an age range or county to focus what you see. This is optional.</p>
        <button type="button" onClick={() => setEditing(true)} aria-expanded={false} className="mt-3 min-h-11 font-semibold text-brand hover:underline">Choose preferences →</button>
      </section>
    );
  }

  if (about && !editing) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-rule py-3">
        <p className="text-eyebrow text-ink-faint">
          Your preferences: {about.age === "unsaid" ? "Age not specified" : AGE_LABELS[about.age]}{about.county ? ` · ${about.county === "elsewhere" ? "Outside the two counties" : about.county}` : ""}
        </p>
        <div className="flex gap-4 text-[13px]">
          <button type="button" onClick={() => setEditing(true)} className="text-brand hover:underline">Change</button>
          <button type="button" onClick={() => { clear(); setAge(""); setCounty(""); }} className="text-ink-faint hover:underline">Clear</button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="about-you-heading" className="flex flex-col gap-4 rounded-md bg-sand-soft p-5 lg:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="about-you-heading" className="font-display text-[22px] font-bold text-ink">Your preferences</h2>
        <button type="button" onClick={() => setEditing(false)} className="min-h-11 text-[13px] text-brand hover:underline">Cancel</button>
      </div>
      <p className="text-[15px] leading-relaxed text-ink-soft">Your choices are saved in this browser. Age and county filters may be sent when loading resources. You can clear your choices here. <Link to="/privacy" className="text-brand underline">Privacy details</Link></p>

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

      <button
        type="button"
        onClick={() => { save({ age: age || "unsaid", county }); setEditing(false); }}
        className="inline-flex min-h-11 items-center self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface disabled:opacity-40"
      >
        Save on this device
      </button>
    </section>
  );
}
