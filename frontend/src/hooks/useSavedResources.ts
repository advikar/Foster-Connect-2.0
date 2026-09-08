import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchSavedResources, saveResource, unsaveResource } from "@/lib/api";

/**
 * Shared saved/bookmark state.
 *
 * Fix for audit U-05: the old save button swallowed errors and never
 * hydrated from the server, so an already-saved resource could render as
 * unsaved after a refresh. This hydrates from /api/saved-resources, reports
 * failures with a toast instead of failing silently, and keeps every
 * ResourceRow/detail sheet in sync via the shared query cache.
 */
export function useSavedResources() {
  const queryClient = useQueryClient();
  const { data: saved = [], isError } = useQuery({ queryKey: ["saved-resources"], queryFn: fetchSavedResources });
  const savedIds = new Set(saved.map(resource => resource.id));

  const toggle = useMutation({
    mutationFn: async ({ id, nextSaved }: { id: number; nextSaved: boolean }) => {
      if (nextSaved) await saveResource(id);
      else await unsaveResource(id);
      return { id, nextSaved };
    },
    onSuccess: ({ nextSaved }) => {
      queryClient.invalidateQueries({ queryKey: ["saved-resources"] });
      toast.success(nextSaved ? "Saved for later" : "Removed from saved");
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : "Could not update your saved list. Try again.");
    },
  });

  return {
    savedCount: saved.length,
    isSaved: (id: number) => savedIds.has(id),
    toggleSave: (id: number) => toggle.mutate({ id, nextSaved: !savedIds.has(id) }),
    hydrationFailed: isError,
  };
}
