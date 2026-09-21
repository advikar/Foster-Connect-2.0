import { jsPDF } from "jspdf";
import { fetchRoadmap, fetchRoadmaps, fetchSavedResources, type ResourceItem, type Roadmap, type RoadmapTask } from "@/lib/api";

/**
 * "Take a copy with you" as a PDF a person can actually read: the plan with
 * every step and the program behind it, then saved listings with the details
 * needed to act (who qualifies, how to start, what to bring, phone, address).
 *
 * Built in the browser from the same data the pages show. Nothing is sent
 * anywhere; the file is created on the device and offered as a download.
 */

const TIMEFRAME_LABEL: Record<RoadmapTask["timeframe"], string> = {
  "This Week": "This week",
  "30 Days": "Next 30 days",
  "3-6 Months": "3 to 6 months",
  "6-12 Months": "6 to 12 months",
};
const TIMEFRAME_ORDER: RoadmapTask["timeframe"][] = ["This Week", "30 Days", "3-6 Months", "6-12 Months"];
const STATUS_LABEL: Record<RoadmapTask["status"], string> = {
  not_started: "To do",
  in_progress: "In progress",
  completed: "Done",
  blocked: "Stuck",
};

class Doc {
  private readonly pdf = new jsPDF({ unit: "pt", format: "letter" });
  private y = 64;
  private readonly left = 56;
  private readonly width = 612 - 56 * 2;
  private readonly bottom = 792 - 64;

  private ensure(height: number) {
    if (this.y + height > this.bottom) { this.pdf.addPage(); this.y = 64; }
  }
  heading(text: string, size = 20) {
    this.ensure(size + 18);
    this.y += 10;
    this.pdf.setFont("helvetica", "bold"); this.pdf.setFontSize(size); this.pdf.setTextColor(20, 20, 20);
    this.pdf.text(text, this.left, this.y);
    this.y += size + 8;
  }
  sub(text: string) { this.heading(text, 14); }
  text(text: string, options: { size?: number; bold?: boolean; indent?: number; muted?: boolean } = {}) {
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    this.pdf.setFont("helvetica", options.bold ? "bold" : "normal"); this.pdf.setFontSize(size);
    this.pdf.setTextColor(options.muted ? 100 : 30, options.muted ? 100 : 30, options.muted ? 100 : 30);
    const lines = this.pdf.splitTextToSize(text, this.width - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      this.ensure(lineHeight);
      this.pdf.text(line, this.left + indent, this.y);
      this.y += lineHeight;
    }
  }
  field(label: string, value: string | null | undefined, indent = 0) {
    const v = (value ?? "").trim();
    if (!v) return;
    this.text(`${label}: ${v}`, { indent, size: 10.5 });
  }
  gap(points = 8) { this.y += points; }
  rule() {
    this.ensure(12);
    this.pdf.setDrawColor(200, 200, 200); this.pdf.line(this.left, this.y, this.left + this.width, this.y);
    this.y += 12;
  }
  checkbox(text: string, done: boolean, indent = 0) {
    const size = 11; const lineHeight = size * 1.35;
    this.pdf.setFont("helvetica", "normal"); this.pdf.setFontSize(size); this.pdf.setTextColor(30, 30, 30);
    const lines = this.pdf.splitTextToSize(text, this.width - indent - 18) as string[];
    this.ensure(lineHeight * lines.length);
    this.pdf.setDrawColor(60, 60, 60); this.pdf.rect(this.left + indent, this.y - 8.5, 9, 9);
    if (done) { this.pdf.setFont("helvetica", "bold"); this.pdf.text("x", this.left + indent + 1.8, this.y - 1.2); this.pdf.setFont("helvetica", "normal"); }
    for (const [index, line] of lines.entries()) {
      if (index > 0) this.ensure(lineHeight);
      this.pdf.text(line, this.left + indent + 18, this.y);
      this.y += lineHeight;
    }
  }
  footer() {
    const pages = this.pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      this.pdf.setPage(page);
      this.pdf.setFont("helvetica", "normal"); this.pdf.setFontSize(9); this.pdf.setTextColor(120, 120, 120);
      this.pdf.text(`Foster Guide · fosterguide.org · page ${page} of ${pages}`, this.left, 792 - 36);
    }
  }
  save(name: string) { this.pdf.save(name); }
}

function resourceBlock(doc: Doc, resource: ResourceItem, indent = 0) {
  doc.text(resource.title, { bold: true, indent });
  if (resource.organization && resource.organization !== resource.title) doc.text(resource.organization, { indent, muted: true, size: 10.5 });
  if (resource.description) doc.text(resource.description, { indent, size: 10.5 });
  doc.field("Who it helps", resource.eligibility, indent);
  doc.field("Cost", resource.cost, indent);
  doc.field("How to start", resource.applicationSteps, indent);
  doc.field("What to bring", resource.whatToBring, indent);
  doc.field("Phone", resource.phone, indent);
  doc.field("Website", resource.website, indent);
  doc.field("Address", resource.address, indent);
  doc.field("Hours", resource.hours, indent);
  doc.field("Languages", resource.languages, indent);
  doc.field("Area", resource.county, indent);
  doc.field("Last checked", resource.verifiedAt, indent);
  doc.gap(6);
}

function planSection(doc: Doc, plan: Roadmap) {
  doc.heading(plan.title || "My plan", 18);
  if (plan.goalSummary) doc.text(plan.goalSummary, { size: 11.5 });
  doc.text(`${plan.county} · started ${new Date(plan.createdAt.replace(" ", "T")).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`, { muted: true, size: 10 });
  const byId = new Map(plan.recommendedResources.map(resource => [resource.id, resource]));
  const done = plan.tasks.filter(task => task.status === "completed").length;
  doc.gap(4);
  doc.text(`${done} of ${plan.tasks.length} steps done.`, { size: 10.5, muted: true });

  for (const frame of TIMEFRAME_ORDER) {
    const tasks = plan.tasks.filter(task => task.timeframe === frame).sort((a, b) => a.taskOrder - b.taskOrder);
    if (!tasks.length) continue;
    doc.sub(TIMEFRAME_LABEL[frame]);
    for (const task of tasks) {
      const bits = [STATUS_LABEL[task.status]];
      if (task.dueDate) bits.push(`by ${task.dueDate}`);
      doc.checkbox(`${task.taskText}  (${bits.join(", ")})`, task.status === "completed");
      if (task.whyItMatters) doc.text(`Why: ${task.whyItMatters}`, { indent: 18, size: 10, muted: true });
      if (task.blockerReason) doc.text(`Stuck because: ${task.blockerReason}`, { indent: 18, size: 10 });
      if (task.privateNote) doc.text(`My note: ${task.privateNote}`, { indent: 18, size: 10 });
      const resource = task.resourceId ? byId.get(task.resourceId) : undefined;
      if (resource) {
        const contact = [resource.phone && `call ${resource.phone}`, resource.website && resource.website, resource.address && resource.address].filter(Boolean).join(" · ");
        doc.text(`Program: ${resource.title}${contact ? ` — ${contact}` : ""}`, { indent: 18, size: 10 });
      }
      doc.gap(3);
    }
  }
  if (plan.recommendedResources.length) {
    doc.sub("Programs in this plan");
    for (const resource of plan.recommendedResources) resourceBlock(doc, resource);
  }
}

/** Everything this session holds, as one PDF. Returns the number of plans and saved listings included. */
export async function downloadMyDataPdf(): Promise<{ plans: number; saved: number }> {
  const [list, saved] = await Promise.all([fetchRoadmaps(), fetchSavedResources().catch(() => [] as ResourceItem[])]);
  const plans = await Promise.all(list.map(item => fetchRoadmap(item.id)));
  const doc = new Doc();
  doc.heading("Foster Guide · my plan and saved programs", 20);
  doc.text(`Downloaded ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. Program details were checked against public information on the date shown; confirm with the program before you go. This is a directory, not legal advice.`, { size: 10, muted: true });
  doc.rule();

  if (!plans.length && !saved.length) {
    doc.text("Nothing is saved for this browser yet. Make a plan from My plan, or save a listing from Find, and download again.");
  }
  for (const plan of plans) { planSection(doc, plan); doc.rule(); }
  if (saved.length) {
    doc.heading("Saved programs", 18);
    for (const resource of saved) resourceBlock(doc, resource);
  }
  doc.heading("If you need help right now", 14);
  doc.text("988 — call or text, 24/7 (Suicide & Crisis Lifeline)");
  doc.text("Text HOME to 741741 — Crisis Text Line");
  doc.text("1-800-786-2929 — National Runaway Safeline");
  doc.text("911 — immediate danger");
  doc.footer();
  doc.save(`foster-guide-my-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
  return { plans: plans.length, saved: saved.length };
}

/** One plan only, from the My plan page. */
export async function downloadPlanPdf(plan: Roadmap) {
  const doc = new Doc();
  planSection(doc, plan);
  doc.rule();
  doc.text("Program details were checked against public information on the date shown; confirm with the program before you go. Foster Guide is a directory, not legal advice. If you need help right now: 988 (call or text), text HOME to 741741, 1-800-786-2929, or 911 in immediate danger.", { size: 9.5, muted: true });
  doc.footer();
  doc.save(`foster-guide-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
}
