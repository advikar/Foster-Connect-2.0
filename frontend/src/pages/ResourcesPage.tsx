import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, PlusCircle, Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/primitives/Chip";
import { BottomSheet } from "@/components/primitives/BottomSheet";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useAboutYou } from "@/hooks/useAboutYou";
import { fetchResources, type ResourcePage } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Categories and counties include every value that appears in the real
 * resource data (one filter per real category; see data/build_resources.py).
 * Labels are plain words; values are the stored category names.
 */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "All", label: "Any" },
  { value: "Housing", label: "Housing" },
  { value: "Financial Support", label: "Money & benefits" },
  { value: "Education", label: "School" },
  { value: "Scholarships", label: "Scholarships" },
  { value: "Employment", label: "Work" },
  { value: "Healthcare", label: "Health" },
  { value: "Mental Health", label: "Talk to someone" },
  { value: "Food Assistance", label: "Food" },
  { value: "Legal Support", label: "Legal" },
  { value: "Transportation", label: "Getting around" },
  { value: "Life Skills and Mentoring", label: "Mentoring & life skills" },
  { value: "Community Support", label: "Community support" },
  { value: "Clothing Assistance", label: "Clothing" },
  { value: "Technology", label: "Technology" },
  { value: "Other", label: "Other" },
];
const COUNTIES = [
  { value: "All", label: "Anywhere" },
  { value: "Alameda", label: "Alameda" },
  { value: "Contra Costa", label: "Contra Costa" },
  { value: "Bay Area", label: "Bay Area" },
  { value: "California", label: "California-wide" },
  { value: "National", label: "National" },
];
/** Age bands map to one representative age the API can filter on. */
const AGES = [
  { value: "All", label: "Any age", age: undefined },
  { value: "under18", label: "Under 18", age: 17 },
  { value: "18-20", label: "18–20", age: 19 },
  { value: "21-24", label: "21–24", age: 22 },
  { value: "25plus", label: "25+", age: 26 },
];
const URGENCIES = [
  { value: "All", label: "Any" },
  { value: "Emergency", label: "Tonight / emergency" },
  { value: "Urgent", label: "This week" },
  { value: "Standard", label: "Whenever" },
];

const PAGE_SIZE = 25;
const QUICK = ["Housing", "Financial Support", "Education", "Employment", "Food Assistance", "Mental Health"];

export function ResourcesPage() {
  const [params, setParams] = useSearchParams();
  const { about } = useAboutYou();
  const [search, setSearch] = useState(params.get("q") || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchId = useId();

  const category = params.get("category") || "All";
  const county = params.get("county") || "All";
  const urgency = params.get("urgency") || "All";
  const ageBand = params.get("age") || "All";
  const activeFilterCount = [category, county, urgency, ageBand].filter(value => value !== "All").length;

  // First visit with an "About you" saved: pre-fill age and county, once.
  useEffect(() => {
    if (!about || params.toString().length > 0) return;
    const next = new URLSearchParams();
    if (about.age && about.age !== "unsaid") next.set("age", about.age);
    if (about.county && about.county !== "elsewhere") next.set("county", about.county);
    if (next.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about?.savedAt]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search);
      else next.delete("q");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "All") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    ["category", "county", "urgency", "age"].forEach(key => next.delete(key));
    setParams(next);
  };

  const age = AGES.find(option => option.value === ageBand)?.age;
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isFetching } =
    useInfiniteQuery<ResourcePage>({
      queryKey: ["resources", search, category, county, urgency, age],
      queryFn: ({ pageParam = 0 }) =>
        fetchResources({ q: search || undefined, category, county, urgency, age, limit: PAGE_SIZE, offset: pageParam as number }),
      initialPageParam: 0,
      getNextPageParam: last => (last.hasMore ? last.offset + last.items.length : undefined),
      placeholderData: keepPreviousData,
    });
  const resources = data?.pages.flatMap(page => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const heading = [
    total === 1 ? "1 listing" : `${total} listings`,
    category !== "All" ? `for ${labelOf(CATEGORIES, category).toLowerCase()}` : "",
    ageBand !== "All" ? `· ages ${labelOf(AGES, ageBand)}` : "",
    county !== "All" ? `· ${labelOf(COUNTIES, county)}` : "",
  ].filter(Boolean).join(" ");

  const filterRail = (
    <div className="flex flex-col gap-7">
      <FilterGroup label="Kind of support" value={category} options={CATEGORIES} onChange={value => setFilter("category", value)} />
      <FilterGroup label="Where" value={county} options={COUNTIES} onChange={value => setFilter("county", value)} />
      <FilterGroup label="Who it's for" value={ageBand} options={AGES} onChange={value => setFilter("age", value)} />
      <FilterGroup label="How urgent" value={urgency} options={URGENCIES} onChange={value => setFilter("urgency", value)} />
    </div>
  );

  return (
    <div>
      {/* Search bar */}
      <div className="border-b border-rule bg-surface">
        <div className="container-wide flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:gap-4 lg:py-5">
          <form role="search" onSubmit={event => event.preventDefault()} className="flex flex-1 items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink lg:max-w-[720px]">
            <Search className="size-5 shrink-0 text-ink-faint" aria-hidden />
            <label htmlFor={searchId} className="sr-only">Search resources</label>
            <input
              id={searchId}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="a place to stay tonight, a bus pass, help with my ID…"
              className="h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-ink-body outline-none placeholder:text-ink-stamp"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="flex size-10 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"><X className="size-4" /></button>
            )}
          </form>
          <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
            <Chip selected={false} onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal className="size-4" />} className="shrink-0 border-ink text-ink">
              Filters{activeFilterCount > 0 && <span className="ml-1 rounded-full bg-ink px-1.5 text-[11px] text-white">{activeFilterCount}</span>}
            </Chip>
            {QUICK.map(value => (
              <Chip key={value} selected={category === value} onClick={() => setFilter("category", category === value ? "All" : value)} className="shrink-0">
                {labelOf(CATEGORIES, value)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="container-wide grid gap-10 pt-6 lg:grid-cols-[260px_1fr] lg:gap-14 lg:pt-10">
        <aside className="hidden lg:block">
          <div className="flex items-baseline justify-between pb-5">
            <h2 className="font-display text-[20px] font-bold text-ink">Narrow it down</h2>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-[13px] text-brand hover:underline">Clear</button>}
          </div>
          {filterRail}
        </aside>

        <section aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-display text-[24px] font-bold text-ink lg:text-[28px]">{isPending ? "Looking…" : isError ? "Find support" : heading}</h1>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 lg:hidden">
                {[["category", category, CATEGORIES], ["county", county, COUNTIES], ["age", ageBand, AGES], ["urgency", urgency, URGENCIES]]
                  .filter(([, value]) => value !== "All")
                  .map(([key, value, options]) => (
                    <button key={key as string} type="button" onClick={() => setFilter(key as string, "All")} aria-label={`Remove ${value} filter`} className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[12px] font-semibold text-white">
                      {labelOf(options as typeof CATEGORIES, value as string)} <X className="size-3" />
                    </button>
                  ))}
              </div>
            )}
          </div>

          {isPending ? (
            <div aria-busy="true" aria-label="Loading resources" className="mt-6 divide-y divide-rule border-t border-rule">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[104px] animate-pulse" />)}
            </div>
          ) : isError ? (
            <Empty
              title="Can't reach the directory"
              detail="We couldn't load listings right now. Your search is still here. Try again, or use Need help now for urgent support."
              onRetry={() => { void refetch(); }}
              retrying={isFetching}
            />
          ) : resources.length === 0 ? (
            <Empty
              title="Nothing matched that"
              detail="Try fewer words, or widen the location. If we don't have something, we'd rather say so than guess."
              onClear={activeFilterCount > 0 ? clearFilters : undefined}
            />
          ) : (
            <>
              <ul className="mt-4 divide-y divide-rule border-t border-rule">
                {resources.map(resource => <li key={resource.id}><ResourceRow resource={resource} /></li>)}
              </ul>
              {hasNextPage && (
                <div className="flex justify-center border-t border-rule py-6">
                  <Button type="button" variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="h-11 rounded-md border-ink px-5 text-[15px] font-semibold text-ink">
                    {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                    {isFetchingNextPage ? "Loading" : `Show ${Math.min(PAGE_SIZE, total - resources.length)} more (${total - resources.length} left)`}
                  </Button>
                </div>
              )}
              <div className="mt-8 max-w-[640px] rounded-md bg-sand-soft p-6">
                <h2 className="font-display text-[20px] font-bold text-ink">Know a program we don&rsquo;t list?</h2>
                <p className="mt-1.5 text-[15px] text-ink-soft">Tell us. A person checks it before it shows up here.</p>
                <Link to="/add-resource" className="mt-2 inline-flex min-h-10 items-center text-[15px] font-semibold text-brand hover:underline">Tell us about it →</Link>
              </div>
            </>
          )}
        </section>
      </div>

      <BottomSheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters" side="bottom">
        <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[24px] font-bold text-ink">Filters</h2>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="-mr-2 flex size-11 items-center justify-center rounded-md text-ink-faint hover:bg-sunk"><X className="size-5" /></button>
          </div>
          <ChipGroup label="Kind of support" value={category} options={CATEGORIES} onChange={value => setFilter("category", value)} />
          <ChipGroup label="Where" value={county} options={COUNTIES} onChange={value => setFilter("county", value)} />
          <ChipGroup label="Who it's for" value={ageBand} options={AGES} onChange={value => setFilter("age", value)} />
          <ChipGroup label="How urgent" value={urgency} options={URGENCIES} onChange={value => setFilter("urgency", value)} />
          <div className="flex gap-2.5 pt-2">
            {activeFilterCount > 0 && <Button type="button" variant="outline" onClick={clearFilters} className="h-13 rounded-md border-ink px-5 text-[15px] font-semibold text-ink">Clear</Button>}
            <Button type="button" onClick={() => setFiltersOpen(false)} className="h-13 flex-1 rounded-md bg-brand text-[16px] font-semibold text-white hover:bg-brand-deep">
              {isError ? "Apply filters" : isPending ? "Loading…" : `Show ${total} ${total === 1 ? "listing" : "listings"}`}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function labelOf(options: { value: string; label: string }[], value: string) {
  return options.find(option => option.value === value)?.label ?? value;
}

/** Desktop rail: a quiet list, selected row tinted. */
function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="text-eyebrow pb-2 text-ink-faint">{label}</legend>
      <div className="flex flex-col">
        {options.map(option => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.value)}
              className={cn("-mx-2 flex min-h-9 items-center rounded px-2 text-left text-[15px]", on ? "bg-brand-soft font-semibold text-ink" : "text-ink-soft hover:text-ink")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChipGroup({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="pb-2 text-[13px] font-semibold text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => <Chip key={option.value} selected={value === option.value} onClick={() => onChange(option.value)}>{option.label}</Chip>)}
      </div>
    </fieldset>
  );
}

function Empty({ title, detail, onClear, onRetry, retrying }: { title: string; detail: string; onClear?: () => void; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-md border border-dashed border-rule p-8">
      <Search className="size-7 text-brand" strokeWidth={1.5} />
      <h2 className="font-display text-[22px] font-bold text-ink">{title}</h2>
      <p className="max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">{detail}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        {onRetry && <Button onClick={onRetry} disabled={retrying} className="h-11 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep"><RotateCcw className="size-4" />{retrying ? "Trying again…" : "Try again"}</Button>}
        {onClear && <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-md border border-ink px-5 font-semibold text-ink">Clear filters</button>}
        {!onRetry && (
          <Link to="/add-resource" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-brand hover:underline">
            <PlusCircle className="size-4" /> Tell us about one we&rsquo;re missing
          </Link>
        )}
      </div>
    </div>
  );
}
