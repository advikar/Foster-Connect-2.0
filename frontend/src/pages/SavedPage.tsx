import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { Chip } from "@/components/primitives/Chip";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { fetchSavedResources } from "@/lib/api";

export function SavedPage() {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["saved-resources"], queryFn: fetchSavedResources });
  const [filter, setFilter] = useState("All");
  const categories = Array.from(new Set(data.map(resource => resource.category)));
  const shown = filter === "All" ? data : data.filter(resource => resource.category === filter);

  return (
    <div className="container-wide grid gap-10 pt-8 lg:grid-cols-[7fr_4fr] lg:gap-16 lg:pt-12">
      <div>
        <h1 className="text-display text-ink">Saved</h1>
        <p className="mt-2 text-[16px] text-ink-soft">
          {data.length === 0 ? "Listings you bookmark land here." : `${data.length} ${data.length === 1 ? "listing" : "listings"}, kept for this browser. Nothing here is tied to your name.`}
        </p>

        {isLoading ? (
          <p className="mt-8 text-[14px] text-ink-faint">Loading…</p>
        ) : isError ? (
          <p role="alert" className="mt-8 rounded-md border border-rule bg-surface p-5 text-[15px] text-ink-soft">We couldn&rsquo;t load your saved list right now. It&rsquo;s still there; try again in a moment.</p>
        ) : data.length === 0 ? (
          <div className="mt-8 flex flex-col items-start gap-3 rounded-md border border-dashed border-rule p-8">
            <Bookmark className="size-8 text-brand" strokeWidth={1.5} />
            <h2 className="font-display text-[22px] font-bold text-ink">Nothing saved yet.</h2>
            <p className="max-w-[40ch] text-[15px] leading-relaxed text-ink-soft">Tap Save on any listing and it lands here. Kept in this browser, not on an account.</p>
            <Link to="/resources" className="mt-1 inline-flex h-12 items-center rounded-md bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep">Find support</Link>
          </div>
        ) : (
          <>
            {categories.length > 1 && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Chip selected={filter === "All"} onClick={() => setFilter("All")}>All {data.length}</Chip>
                {categories.map(category => (
                  <Chip key={category} selected={filter === category} onClick={() => setFilter(category)}>
                    {category} {data.filter(resource => resource.category === category).length}
                  </Chip>
                ))}
              </div>
            )}
            <ul className="mt-4 divide-y divide-rule border-t border-rule">
              {shown.map(resource => <li key={resource.id}><ResourceRow resource={resource} /></li>)}
            </ul>
          </>
        )}
      </div>

      <aside className="flex flex-col gap-6">
        {data.length > 0 && (
          <section className="flex flex-col gap-3 rounded-md bg-sand-soft p-6">
            <h2 className="font-display text-[22px] font-bold text-ink">Turn these into steps?</h2>
            <p className="text-[15px] leading-relaxed text-ink-soft">A plan puts what you&rsquo;ve saved in order, with the paperwork most programs ask for first.</p>
            <Link to="/roadmap" className="inline-flex min-h-11 items-center self-start rounded-md border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-surface">Build a plan</Link>
          </section>
        )}
        <div className="text-[14px] leading-relaxed text-ink-faint">
          <p>On a shared or library computer? You can clear everything from this browser in two taps.</p>
          <Link to="/privacy" className="mt-1 inline-block text-brand hover:underline">Your data</Link>
        </div>
      </aside>
    </div>
  );
}
