import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addTask, fetchRoadmap, fetchRoadmaps, type ResourceItem } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * "Add to my plan" from a listing (founder review, Sep 2026).
 *
 * Adds one step to the person's current plan, linked to this listing, so the
 * plan page shows the program with its phone number and how to start. With no
 * plan yet it links to the plan builder instead. Already in the plan: a
 * quiet "In your plan" link, not a second copy.
 */
export function AddToPlanButton({ resource, compact = false }: { resource: ResourceItem; compact?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: roadmaps = [], isLoading } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  const activeId = roadmaps[0]?.id;
  const { data: roadmap } = useQuery({ queryKey: ["roadmap", activeId], queryFn: () => fetchRoadmap(activeId!), enabled: Boolean(activeId), retry: 1 });
  const inPlan = roadmap?.tasks.some(task => task.resourceId === resource.id) ?? false;

  const add = useMutation({
    mutationFn: () => addTask(activeId!, {
      taskText: `Contact ${resource.title}`,
      taskCategory: resource.category,
      whyItMatters: resource.description.length > 500 ? `${resource.description.slice(0, 497)}…` : resource.description,
      resourceId: resource.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", activeId] });
      toast.success("Added to your plan", { action: { label: "Open my plan", onClick: () => navigate("/roadmap") } });
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Could not add that step. Try again."),
  });

  const className = cn("h-12 rounded-md border-ink px-4 text-[15px] font-semibold text-ink", compact && "w-12 px-0");

  if (isLoading) return null;

  if (!activeId) {
    return (
      <Button asChild variant="outline" className={className}>
        <Link to="/roadmap" aria-label="Make a plan to add this step"><ListPlus className="size-4" />{!compact && "Make a plan"}</Link>
      </Button>
    );
  }

  if (inPlan) {
    return (
      <Button asChild variant="outline" className={cn(className, "bg-sand-soft")}>
        <Link to="/roadmap" aria-label="In your plan. Open my plan"><ListPlus className="size-4" />{!compact && "In your plan"}</Link>
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={() => add.mutate()} disabled={add.isPending} aria-label="Add to my plan" className={className}>
      {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
      {!compact && "Add to plan"}
    </Button>
  );
}
