import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LISTING_PARAM, ResourceDetailSheet } from "@/components/resources/ResourceRow";
import { fetchResource } from "@/lib/api";

/**
 * Opens the listing named by ?listing=ID even when no row for it is on the
 * page (a shared link, a reload). Rows seed the query cache when tapped, so
 * the sheet appears without a fetch in the common case. Rows render no sheet
 * of their own; this is the one sheet for the whole youth site.
 */
export function ListingDeepLink() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(LISTING_PARAM);
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const { data } = useQuery({ queryKey: ["resource", id], queryFn: () => fetchResource(id!), enabled: id !== null, staleTime: 5 * 60_000 });
  if (id === null || !data) return null;
  const close = () => { const next = new URLSearchParams(params); next.delete(LISTING_PARAM); setParams(next, { replace: true }); };
  return <ResourceDetailSheet resource={data} open onOpenChange={value => { if (!value) close(); }} />;
}
