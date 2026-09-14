import { useCallback, useEffect, useState } from "react";

/**
 * Optional "About you" context: an age band, a county and a care status.
 *
 * Stored in localStorage on this device only and never sent to the server.
 * It shapes the home page (deadlines, nearby listings) and pre-fills the
 * directory's age filter. Skipping is the default; skipping means unknown.
 */
export type AgeBand = "under18" | "18-20" | "21-24" | "25plus" | "unsaid";
export type CareStatus = "in_care" | "former" | "unsure";
export type AboutCounty = "Alameda" | "Contra Costa" | "elsewhere";

export interface AboutYou {
  age: AgeBand;
  county: AboutCounty | "";
  care: CareStatus | "";
  savedAt: string;
}

const KEY = "fc-about-you";
const EVENT = "fc-about-you-changed";

export const AGE_LABELS: Record<AgeBand, string> = {
  under18: "Under 18", "18-20": "18–20", "21-24": "21–24", "25plus": "25+", unsaid: "Rather not say",
};
export const CARE_LABELS: Record<CareStatus, string> = {
  in_care: "In care now", former: "Was in care", unsure: "Not sure / other",
};

function read(): AboutYou | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AboutYou>;
    if (!parsed || typeof parsed !== "object" || !parsed.age) return null;
    return { age: parsed.age, county: parsed.county ?? "", care: parsed.care ?? "", savedAt: parsed.savedAt ?? "" };
  } catch {
    return null;
  }
}

export function useAboutYou() {
  const [about, setAbout] = useState<AboutYou | null>(() => (typeof window === "undefined" ? null : read()));

  useEffect(() => {
    const sync = () => setAbout(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const save = useCallback((next: Omit<AboutYou, "savedAt">) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...next, savedAt: new Date().toISOString() }));
    } catch {
      // Private mode or full storage: the page still works, it just won't remember.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { about, save, clear };
}

/** The directory's age filter value that matches an age band, if any. */
export function ageBandToFilter(age: AgeBand | undefined): string | undefined {
  if (!age || age === "unsaid") return undefined;
  return age;
}
