import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { fetchSavedResources } from "@/lib/api";

export function SavedPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["saved-resources"], queryFn: fetchSavedResources });
  return (
    <div className="container-wide pb-12 pt-9 lg:pt-14">
      <h1 className="text-display-sm text-ink lg:text-hero">Saved</h1>
      <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-ink-soft">Things you bookmarked. Kept on this device only.</p>
      {!isLoading && data.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-rule bg-surface p-14 text-center">
          <Bookmark className="mx-auto size-7 text-ink-faint" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-lg font-bold tracking-[-0.02em] text-ink">Nothing saved yet</h2>
          <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-relaxed text-ink-soft">Tap the bookmark on anything you find, and it\u2019ll show up here.</p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-rule-soft rounded-2xl border border-rule bg-surface px-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 xl:grid-cols-3">
          {data.map(resource => <div key={resource.id} className="lg:rounded-2xl lg:border lg:border-rule lg:bg-surface lg:px-5"><ResourceRow resource={resource} /></div>)}
        </div>
      )}
    </div>
  );
}
