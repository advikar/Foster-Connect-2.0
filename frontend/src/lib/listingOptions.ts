/** Canonical category and region lists. Must match data/build_resources.py and the backend's COUNTY_OPTIONS. */
export const CATEGORY_OPTIONS = [
  "Housing", "Education", "Scholarships", "Employment", "Financial Support", "Healthcare",
  "Mental Health", "Legal Support", "Food Assistance", "Clothing Assistance", "Transportation",
  "Community Support", "Life Skills and Mentoring", "Technology", "Other",
];
export const COUNTY_OPTIONS = ["Alameda", "Contra Costa", "Bay Area", "California", "National"];
/** "Alameda, Contra Costa" → ["Alameda", "Contra Costa"]. */
export function splitCounties(value: string) { return value.split(",").map(part => part.trim()).filter(Boolean); }
