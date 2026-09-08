import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, PlusCircle, Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/primitives/Chip";
import { BottomSheet } from "@/components/primitives/BottomSheet";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { fetchResources, type ResourcePage } from "@/lib/api";

/**
 * Categories and counties include every value that appears in the real
 * resource data, and must match data/build_resources.py's canonical
 * category list 1:1 (see CATEGORY_ALIASES there) -- one filter chip per
 * real category. "Financial Aid" and "Financial Support" used to be two
 * chips for the same bucket because different research passes typed the
 * word differently; the data is now reconciled to "Financial Support" only.
 * "Life Skills and Mentoring", "Technology", and "Other" are real categories
 * in the data that had no chip at all, which made those resources
 * unreachable by category filter even though "Financial Aid" and "Clothing
 * Assistance" had chips (audit D-02, D-03). "Bay Area" is a real county
 * value for the same reason.
 */
const categories = [
  "All", "Housing", "Financial Support", "Education", "Scholarships",
  "Employment", "Healthcare", "Mental Health", "Food Assistance", "Clothing Assistance",
  "Transportation", "Legal Support", "Community Support", "Life Skills and Mentoring",
  "Technology", "Other",
];
const counties = ["All", "Alameda", "Contra Costa", "Bay Area", "California", "National"];
const urgencies = ["All", "Emergency", "Urgent", "Standard"];

const PAGE_SIZE = 25;

export function ResourcesPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchId = useId();

  const category = params.get("category") || "All";
  const county = params.get("county") || "All";
  const urgency = params.get("urgency") || "All";
  const activeFilterCount = [category, county, urgency].filter(value => value !== "All").length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search);
      else next.delete("q");
      setParams(next, { replace: true });
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
    ["category", "county", "urgency"].forEach(key => next.delete(key));
    setParams(next);
  };

  // Paged, so all real resources are reachable (401 as of the 2026-09-08
  // catalogue expansion, not a fixed number -- the old hard cap of 100 hid
  // resources past it with no error and no "load more") (audit D-01).
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isFetching } =
    useInfiniteQuery<ResourcePage>({
      queryKey: ["resources", search, category, county, urgency],
      queryFn: ({ pageParam = 0 }) =>
        fetchResources({
          q: search || undefined, category, county, urgency,
          limit: PAGE_SIZE, offset: pageParam as number,
        }),
      initialPageParam: 0,
      getNextPageParam: last => (last.hasMore ? last.offset + last.items.length : undefined),
      placeholderData: keepPreviousData,
    });

  const resources = data?.pages.flatMap(page => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="container-wide pb-12 pt-9 lg:pt-14">
      <h1 className="text-display-sm text-ink lg:text-[46px] lg:leading-[0.98]">Find support</h1>
      <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-ink-soft">
        Find a starting point for housing, work, school, and everyday life.
        Open a resource for eligibility, contact details, and how to begin.
      </p>

      <div className="sticky top-14 z-20 -mx-5 mt-6 bg-ground px-5 pb-3 pt-2 lg:top-[76px] lg:mx-0 lg:max-w-[760px] lg:px-0">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">Search resources</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            id={searchId}
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="h-12 rounded-xl border-rule bg-surface pl-11 text-base"
            placeholder="a place to stay tonight"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="h-10 rounded-full border-rule bg-surface px-4 text-sm font-medium"
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-brand px-1.5 text-xs font-semibold text-on-brand">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {!isLoading && !isError && (
            <span className="tabular text-[13px] font-medium text-ink-faint">
              {total} {total === 1 ? "result" : "results"}
            </span>
          )}
        </div>
      </div>

      <div className="mb-5 mt-2 flex flex-wrap gap-2" aria-label="Quick categories">
        {["All", "Housing", "Financial Support", "Employment", "Education", "Food Assistance"].map(value => (
          <Chip key={value} selected={category === value} onClick={() => setFilter("category", value)} className="text-sm">
            {{ All: "All support", Housing: "Housing", "Financial Support": "Money & benefits", Employment: "Work", Education: "School", "Food Assistance": "Food" }[value]}
          </Chip>
        ))}
      </div>
      {activeFilterCount > 0 && <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
        {[["category", category], ["county", county], ["urgency", urgency]].filter(([, value]) => value !== "All").map(([key, value]) => <button key={key} onClick={() => setFilter(key, "All")} aria-label={`Remove ${value} filter`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rule bg-surface px-3 text-sm text-ink">{value}<X className="size-3.5" /></button>)}
        <button onClick={clearFilters} className="min-h-11 px-3 text-sm font-semibold text-brand hover:underline">Clear filters</button>
      </div>}
      {isLoading ? (
        <div
          className="mt-2 space-y-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Loading resources"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-sunk" />
          ))}
        </div>
      ) : isError ? (
        <Empty
          title="Can't reach the directory"
          detail="We couldn’t load resources right now. Your search is still here. Try again, or use Need help now for urgent support."
          onRetry={() => { void refetch(); }}
          retrying={isFetching}
        />
      ) : resources.length === 0 ? (
        <Empty
          title="Nothing matched that"
          detail="Try fewer words, or widen the location. If we don't have something, we'll say so rather than guess."
          onClear={activeFilterCount > 0 ? clearFilters : undefined}
        />
      ) : (
        <>
          <ul className="mt-1 overflow-hidden rounded-2xl border border-rule bg-surface lg:grid lg:grid-cols-2 lg:gap-4 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent xl:grid-cols-3">
            {resources.map(resource => (
              <li
                key={resource.id}
                className="px-4 first:pt-1 last:pb-1 lg:rounded-2xl lg:border lg:border-rule lg:bg-surface lg:px-5 lg:py-1 lg:transition-colors lg:first:pt-1 lg:hover:border-brand"
              >
                <ResourceRow resource={resource} />
              </li>
            ))}
          </ul>

          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-11 rounded-full border-rule bg-surface px-6 text-sm font-semibold"
              >
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                {isFetchingNextPage ? "Loading" : `Show more (${total - resources.length} left)`}
              </Button>
            </div>
          )}
        </>
      )}

      <BottomSheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters">
        <div className="space-y-6 p-5 pb-safe sm:p-7">
          <FilterGroup label="Kind of support" value={category} options={categories} onChange={value => setFilter("category", value)} />
          <FilterGroup label="Location" value={county} options={counties} onChange={value => setFilter("county", value)} />
          <FilterGroup label="How urgent" value={urgency} options={urgencies} onChange={value => setFilter("urgency", value)} />
          <div className="flex gap-2">
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-12 rounded-xl border-rule px-5 text-base"
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold text-on-brand hover:opacity-90"
            >
              {isError ? "Apply filters" : isLoading ? "Loading results…" : `Show ${total} ${total === 1 ? "result" : "results"}`}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function FilterGroup({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="text-eyebrow mb-2.5 text-ink-faint">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <Chip key={option} selected={value === option} onClick={() => onChange(option)}>
            {option === "All" ? "Any" : option}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function Empty({ title, detail, onClear, onRetry, retrying }: { title: string; detail: string; onClear?: () => void; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-rule bg-surface px-6 py-14 text-center">
      <Search className="mx-auto size-7 text-ink-faint" strokeWidth={1.5} />
      <h2 className="mt-4 font-display text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-ink-soft">{detail}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
        {onRetry && <Button onClick={onRetry} disabled={retrying} className="min-h-11 rounded-xl bg-brand px-5 text-white"><RotateCcw className="size-4" />{retrying ? "Trying again…" : "Try again"}</Button>}
        {onClear && (
          <button type="button" onClick={onClear} className="text-sm font-semibold text-brand hover:underline">
            Clear filters
          </button>
        )}
        {!onRetry && <Link to="/add-resource" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <PlusCircle className="size-4" />
          Tell us about one we&apos;re missing
        </Link>}
      </div>
    </div>
  );
}
