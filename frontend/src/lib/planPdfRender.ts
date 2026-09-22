import type { jsPDF } from "jspdf";
import type { ResourceItem, Roadmap, RoadmapTask } from "@/lib/api";

/**
 * Draws the "take a copy with you" PDF. Pure: takes a jsPDF instance and
 * data, returns nothing, touches no network — so it can be rendered in a
 * script with sample data and looked at, which is how it was designed.
 *
 * It is set like the site: Source Serif for the title, Source Sans for
 * everything else, the same ink, brand and sand tokens, generous margins,
 * a real checklist, and each program as a card a person can hand to
 * someone at a counter. Falls back to Helvetica if the fonts didn't load.
 */

export interface PdfFonts { sans?: string; sansSemibold?: string; serifBold?: string }
export interface PdfDocument {
  /** Cover title, e.g. "My plan" or "My plan and saved programs". */
  title: string;
  plans: Roadmap[];
  saved: ResourceItem[];
  generatedAt: Date;
}

const PAGE = { w: 612, h: 792, left: 54, right: 54, top: 60, bottom: 64 };
const WIDTH = PAGE.w - PAGE.left - PAGE.right;
const C = {
  brand: [27, 107, 104] as RGB, brandSoft: [228, 239, 238] as RGB, ink: [20, 50, 47] as RGB, body: [42, 38, 34] as RGB,
  soft: [74, 71, 64] as RGB, faint: [107, 103, 94] as RGB, rule: [217, 212, 200] as RGB, ruleSoft: [232, 228, 218] as RGB,
  ground: [244, 242, 237] as RGB, sandSoft: [245, 234, 219] as RGB, crisis: [180, 71, 27] as RGB, crisisSoft: [250, 236, 228] as RGB,
  green: [62, 122, 58] as RGB, white: [255, 255, 255] as RGB,
};
type RGB = [number, number, number];

const TIMEFRAME_LABEL: Record<RoadmapTask["timeframe"], string> = { "This Week": "This week", "30 Days": "Next 30 days", "3-6 Months": "3 to 6 months", "6-12 Months": "6 to 12 months" };
const TIMEFRAME_ORDER: RoadmapTask["timeframe"][] = ["This Week", "30 Days", "3-6 Months", "6-12 Months"];

function longDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value.includes("T") || value.length <= 10 ? value : value.replace(" ", "T")) : value;
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

class Canvas {
  y = PAGE.top;
  private readonly hasFonts: boolean;
  constructor(readonly pdf: jsPDF, fonts: PdfFonts) {
    this.hasFonts = Boolean(fonts.sans && fonts.sansSemibold && fonts.serifBold);
    if (this.hasFonts) {
      pdf.addFileToVFS("SourceSans3-Regular.ttf", fonts.sans!); pdf.addFont("SourceSans3-Regular.ttf", "SourceSans", "normal");
      pdf.addFileToVFS("SourceSans3-Semibold.ttf", fonts.sansSemibold!); pdf.addFont("SourceSans3-Semibold.ttf", "SourceSans", "bold");
      pdf.addFileToVFS("SourceSerif4-Bold.ttf", fonts.serifBold!); pdf.addFont("SourceSerif4-Bold.ttf", "SourceSerif", "bold");
    }
  }
  font(kind: "sans" | "sansBold" | "serif", size: number, color: RGB = C.body) {
    if (this.hasFonts) this.pdf.setFont(kind === "serif" ? "SourceSerif" : "SourceSans", kind === "sans" ? "normal" : "bold");
    else this.pdf.setFont("helvetica", kind === "sans" ? "normal" : "bold");
    this.pdf.setFontSize(size); this.pdf.setTextColor(...color);
  }
  /** Start a new page when `height` would run past the bottom. */
  ensure(height: number) { if (this.y + height > PAGE.h - PAGE.bottom) this.newPage(); }
  newPage() { this.pdf.addPage(); this.y = PAGE.top; }
  lines(text: string, width: number) { return this.pdf.splitTextToSize(text, width) as string[]; }
  /** Wrapped paragraph. Returns the height used; with dry=true only measures. */
  para(text: string, options: { kind?: "sans" | "sansBold" | "serif"; size?: number; color?: RGB; x?: number; width?: number; leading?: number; dry?: boolean; after?: number } = {}) {
    const { kind = "sans", size = 10.5, color = C.body, x = PAGE.left, width = WIDTH, leading = 1.38, dry = false, after = 0 } = options;
    this.font(kind, size, color);
    const lines = this.lines(text, width);
    const lineHeight = size * leading;
    if (dry) return lines.length * lineHeight + after;
    for (const line of lines) {
      this.ensure(lineHeight);
      this.pdf.text(line, x, this.y + size * 0.78);
      this.y += lineHeight;
    }
    this.y += after;
    return lines.length * lineHeight + after;
  }
  eyebrow(text: string, color: RGB = C.brand, x = PAGE.left) {
    this.font("sansBold", 8.5, color);
    this.pdf.text(text.toUpperCase(), x, this.y + 7, { charSpace: 0.9 });
  }
  rule(color: RGB = C.rule, width = 0.6) {
    this.pdf.setDrawColor(...color); this.pdf.setLineWidth(width);
    this.pdf.line(PAGE.left, this.y, PAGE.left + WIDTH, this.y);
  }
  fill(color: RGB) { this.pdf.setFillColor(...color); }
  stroke(color: RGB, width = 0.8) { this.pdf.setDrawColor(...color); this.pdf.setLineWidth(width); }
}

/** The mark from the site header, drawn with vector ops so it prints crisp at any size. */
function mark(c: Canvas, x: number, y: number, size: number) {
  const s = size / 32;
  const p = (px: number, py: number) => [x + px * s, y + py * s] as const;
  c.fill(C.brand); c.pdf.circle(x + 16 * s, y + 16 * s, 16 * s, "F");
  const heart = [
    { op: "m", c: p(16, 27) }, { op: "c", c: [...p(12.2, 23.8), ...p(6, 19.5), ...p(6, 13.8)] }, { op: "c", c: [...p(6, 10.4), ...p(8.5, 8.3), ...p(11.3, 8.3)] },
    { op: "c", c: [...p(13.3, 8.3), ...p(15, 9.4), ...p(16, 11)] }, { op: "c", c: [...p(17, 9.4), ...p(18.7, 8.3), ...p(20.7, 8.3)] },
    { op: "c", c: [...p(23.5, 8.3), ...p(26, 10.4), ...p(26, 13.8)] }, { op: "c", c: [...p(26, 19.5), ...p(19.8, 23.8), ...p(16, 27)] }, { op: "h" },
  ];
  c.fill(C.white); c.pdf.path(heart as never, "F");
  for (const [kx, ky] of [[7.6, 17.7], [9.45, 19.9], [11.3, 22.1], [13.1, 24.3]]) c.pdf.circle(x + kx * s, y + ky * s, 2 * s, "F");
  c.pdf.setLineCap("round"); c.pdf.setLineJoin("round");
  const strokes: [number, { op: string; c: number[] }[]][] = [
    [2.2, [{ op: "m", c: [...p(24.6, 11.5)] }, { op: "l", c: [...p(17.6, 16.4)] }, { op: "l", c: [...p(14, 12.95)] }, { op: "c", c: [...p(12.85, 11.85), ...p(11.05, 13.7), ...p(12.2, 14.8)] }, { op: "l", c: [...p(15.8, 18.3)] }]],
    [1.9, [{ op: "m", c: [...p(17.4, 16.5)] }, { op: "l", c: [...p(19.1, 22)] }, { op: "m", c: [...p(19.2, 15.26)] }, { op: "l", c: [...p(21.4, 19.1)] }, { op: "m", c: [...p(21, 14)] }, { op: "l", c: [...p(23.1, 16.8)] }]],
    [1.3, [{ op: "m", c: [...p(7.58, 19.57)] }, { op: "l", c: [...p(9.73, 17.78)] }, { op: "m", c: [...p(9.48, 21.77)] }, { op: "l", c: [...p(11.63, 19.98)] }, { op: "m", c: [...p(11.28, 23.97)] }, { op: "l", c: [...p(13.43, 22.18)] }, { op: "m", c: [...p(13.08, 26.07)] }, { op: "l", c: [...p(15.23, 24.28)] }]],
  ];
  for (const [width, ops] of strokes) { c.stroke(C.brand, width * s); c.pdf.path(ops as never, "S"); }
}

function header(c: Canvas, generatedAt: Date) {
  mark(c, PAGE.left, PAGE.top - 18, 28);
  c.font("serif", 15, C.ink); c.pdf.text("Foster Guide", PAGE.left + 36, PAGE.top - 2);
  c.font("sans", 9.5, C.faint); c.pdf.text("Your guide for the next step", PAGE.left + 36, PAGE.top + 11);
  c.pdf.text(`Downloaded ${longDate(generatedAt)}`, PAGE.left + WIDTH, PAGE.top + 3, { align: "right" });
  c.y = PAGE.top + 26;
  c.rule(C.rule, 0.6);
  c.y += 26;
}

function sectionLabel(c: Canvas, text: string, count?: string) {
  c.ensure(40);
  c.y += 6;
  c.eyebrow(text);
  if (count) { c.font("sans", 9, C.faint); c.pdf.text(count, PAGE.left + WIDTH, c.y + 7, { align: "right" }); }
  c.y += 12;
  c.rule(C.ruleSoft, 0.6);
  c.y += 12;
}

function checkbox(c: Canvas, x: number, y: number, done: boolean, stuck: boolean) {
  const size = 11;
  if (done) {
    c.fill(C.brand); c.pdf.roundedRect(x, y, size, size, 2, 2, "F");
    c.stroke(C.white, 1.7); c.pdf.setLineCap("round"); c.pdf.setLineJoin("round");
    c.pdf.lines([[2.2, 2.2], [3.8, -4.6]], x + 2.6, y + 5.8, [1, 1], "S", false);
  } else {
    c.stroke(stuck ? C.crisis : C.faint, 0.9); c.pdf.roundedRect(x, y, size, size, 2, 2, "S");
  }
}

function step(c: Canvas, task: RoadmapTask, resource: ResourceItem | undefined, dry: boolean): number {
  const textX = PAGE.left + 20;
  const textW = WIDTH - 20 - 70;
  const done = task.status === "completed";
  const stuck = task.status === "blocked";
  let height = 0;
  const startY = c.y;
  if (!dry) { c.ensure(30); checkbox(c, PAGE.left, c.y + 1, done, stuck); }
  height += c.para(task.taskText, { kind: "sansBold", size: 11.5, color: done ? C.faint : C.ink, x: textX, width: textW, leading: 1.3, dry });
  if (!dry) {
    const tag = done ? "Done" : stuck ? "Stuck" : task.status === "in_progress" ? "Started" : task.dueDate ? `By ${task.dueDate}` : "";
    if (tag) { c.font("sansBold", 8.5, done ? C.green : stuck ? C.crisis : C.faint); c.pdf.text(tag.toUpperCase(), PAGE.left + WIDTH, startY + 9, { align: "right", charSpace: 0.6 }); }
  }
  if (task.whyItMatters) height += c.para(task.whyItMatters, { size: 9.8, color: C.faint, x: textX, width: textW + 60, dry });
  if (stuck && task.blockerReason) height += c.para(`Stuck because: ${task.blockerReason}`, { size: 9.8, color: C.crisis, x: textX, width: textW + 60, dry });
  if (task.privateNote) height += c.para(`My note: ${task.privateNote}`, { size: 9.8, color: C.soft, x: textX, width: textW + 60, dry });
  if (resource) {
    const contact = [resource.phone, resource.address].filter(Boolean).join("  ·  ");
    height += c.para(`${resource.title}${contact ? `  ·  ${contact}` : ""}`, { kind: "sansBold", size: 9.8, color: C.brand, x: textX, width: textW + 60, dry });
  }
  if (!dry) c.y += 9; height += 9;
  return height;
}

function fieldRow(c: Canvas, x: number, width: number, label: string, value: string | null | undefined, dry: boolean): number {
  const v = (value ?? "").trim();
  if (!v) return 0;
  const labelW = 88;
  if (!dry) {
    c.ensure(14);
    c.font("sansBold", 7.8, C.faint); c.pdf.text(label.toUpperCase(), x, c.y + 8, { charSpace: 0.6 });
  }
  return c.para(v, { size: 9.8, color: C.body, x: x + labelW, width: width - labelW, leading: 1.32, dry, after: 3 });
}

function programCard(c: Canvas, resource: ResourceItem, dry = false): number {
  const pad = 13;
  const x = PAGE.left + pad;
  const w = WIDTH - pad * 2;
  const startY = c.y;
  if (!dry) {
    // Measure first so the card moves whole to the next page when it fits there.
    const yBefore = c.y;
    const height = programCard(c, resource, true);
    c.y = yBefore;
    if (height < PAGE.h - PAGE.top - PAGE.bottom) c.ensure(height);
    c.fill(C.ground); c.pdf.roundedRect(PAGE.left, c.y, WIDTH, height, 6, 6, "F");
    c.fill(C.brand); c.pdf.rect(PAGE.left, c.y + 10, 2.5, height - 20, "F");
  }
  let h = 0;
  if (!dry) c.y += pad; h += pad;
  const isGuide = resource.kind === "information";
  h += c.para(resource.title, { kind: "sansBold", size: 12, color: C.ink, x, width: w, leading: 1.25, dry });
  const meta = [resource.organization && resource.organization !== resource.title ? resource.organization : "", resource.county, isGuide ? "Guide" : resource.cost].filter(Boolean).join("  ·  ");
  if (meta) h += c.para(meta, { size: 9.4, color: C.faint, x, width: w, dry, after: 4 });
  if (resource.description) h += c.para(resource.description, { size: 10, color: C.body, x, width: w, dry, after: 5 });
  // Skip rows that only repeat the description or the directory's stand-in text.
  const same = (value: string | null | undefined, other: string | null | undefined) => (value ?? "").trim().toLowerCase() === (other ?? "").trim().toLowerCase();
  if (!same(resource.eligibility, resource.description)) h += fieldRow(c, x, w, "Who it helps", resource.eligibility, dry);
  h += fieldRow(c, x, w, "How to start", resource.applicationSteps, dry);
  if (!/^ask them what to bring/i.test((resource.whatToBring ?? "").trim())) h += fieldRow(c, x, w, "Bring", resource.whatToBring, dry);
  if (isGuide) {
    h += fieldRow(c, x, w, "Open it at", resource.website, dry);
  } else {
    h += fieldRow(c, x, w, "Phone", resource.phone, dry);
    h += fieldRow(c, x, w, "Address", resource.address, dry);
    h += fieldRow(c, x, w, "Hours", resource.hours, dry);
    h += fieldRow(c, x, w, "Website", resource.website, dry);
    h += fieldRow(c, x, w, "Languages", resource.languages, dry);
  }
  if (resource.verifiedAt) h += c.para(`Checked ${longDate(resource.verifiedAt)}`, { size: 8.6, color: C.faint, x, width: w, dry });
  if (!dry) c.y += pad - 4; h += pad - 4;
  if (!dry) c.y += 10;
  return dry ? h : c.y - startY;
}

function plan(c: Canvas, item: Roadmap, cover: boolean) {
  const done = item.tasks.filter(task => task.status === "completed").length;
  c.ensure(120);
  c.eyebrow(`My plan  ·  ${item.county}  ·  started ${longDate(item.createdAt)}`);
  c.y += 16;
  c.para(item.title || "My plan", { kind: "serif", size: cover ? 25 : 20, color: C.ink, leading: 1.12, after: 6 });
  if (item.goalSummary) c.para(item.goalSummary, { size: 11.5, color: C.soft, leading: 1.4, after: 8 });
  // Progress
  c.ensure(24);
  c.font("sansBold", 9.5, C.ink); c.pdf.text(`${done} of ${item.tasks.length} steps done`, PAGE.left, c.y + 8);
  const barY = c.y + 14;
  c.fill(C.ruleSoft); c.pdf.roundedRect(PAGE.left, barY, WIDTH, 5, 2.5, 2.5, "F");
  if (done > 0) { c.fill(C.brand); c.pdf.roundedRect(PAGE.left, barY, Math.max(8, WIDTH * done / Math.max(1, item.tasks.length)), 5, 2.5, 2.5, "F"); }
  c.y = barY + 20;

  const byId = new Map(item.recommendedResources.map(resource => [resource.id, resource]));
  for (const frame of TIMEFRAME_ORDER) {
    const tasks = item.tasks.filter(task => task.timeframe === frame).sort((a, b) => a.taskOrder - b.taskOrder);
    if (!tasks.length) continue;
    const frameDone = tasks.filter(task => task.status === "completed").length;
    sectionLabel(c, TIMEFRAME_LABEL[frame], `${frameDone} of ${tasks.length} done`);
    for (const task of tasks) {
      const resource = task.resourceId ? byId.get(task.resourceId) : undefined;
      const yBefore = c.y;
      const height = step(c, task, resource, true);
      c.y = yBefore;
      c.ensure(Math.min(height, 120));
      step(c, task, resource, false);
    }
  }
  if (item.recommendedResources.length) {
    sectionLabel(c, "Programs in this plan", `${item.recommendedResources.length}`);
    c.para("Everything you need to call, visit or apply. Confirm hours before you go.", { size: 9.8, color: C.faint, after: 8 });
    for (const resource of item.recommendedResources) programCard(c, resource);
  }
}

function helpBox(c: Canvas) {
  const lines = [
    ["988", "Call or text, any hour. Suicide & Crisis Lifeline."],
    ["Text HOME to 741741", "Crisis Text Line."],
    ["1-800-786-2929", "National Runaway Safeline."],
    ["911", "If you are in immediate danger."],
  ];
  const height = 34 + lines.length * 15 + 8;
  c.ensure(height + 10);
  c.fill(C.crisisSoft); c.pdf.roundedRect(PAGE.left, c.y, WIDTH, height, 6, 6, "F");
  c.font("sansBold", 11.5, C.crisis); c.pdf.text("If you need help right now", PAGE.left + 14, c.y + 21);
  let y = c.y + 40;
  for (const [number, what] of lines) {
    c.font("sansBold", 10.2, C.ink); c.pdf.text(number, PAGE.left + 14, y);
    c.font("sans", 9.8, C.soft); c.pdf.text(what, PAGE.left + 150, y);
    y += 15;
  }
  c.y += height + 12;
}

function footer(c: Canvas) {
  const pages = c.pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    c.pdf.setPage(page);
    const y = PAGE.h - 40;
    c.stroke(C.ruleSoft, 0.5); c.pdf.line(PAGE.left, y - 12, PAGE.left + WIDTH, y - 12);
    c.font("sans", 8.5, C.faint);
    c.pdf.text("Foster Guide  ·  fosterguide.org  ·  free, no account, Alameda & Contra Costa", PAGE.left, y);
    c.pdf.text(`Page ${page} of ${pages}`, PAGE.left + WIDTH, y, { align: "right" });
  }
}

export function renderPdf(pdf: jsPDF, doc: PdfDocument, fonts: PdfFonts) {
  const c = new Canvas(pdf, fonts);
  pdf.setProperties({ title: `Foster Guide — ${doc.title}`, creator: "Foster Guide" });
  header(c, doc.generatedAt);
  if (!doc.plans.length && !doc.saved.length) {
    c.para(doc.title, { kind: "serif", size: 24, color: C.ink, after: 8 });
    c.para("Nothing is saved for this browser yet. Make a plan from My plan, or save a listing from Find, and download again.", { size: 11, color: C.soft, after: 16 });
  }
  doc.plans.forEach((item, index) => {
    if (index > 0) c.newPage();
    plan(c, item, index === 0);
  });
  if (doc.saved.length) {
    if (doc.plans.length) { c.y += 6; c.ensure(140); }
    c.eyebrow("Saved programs"); c.y += 16;
    c.para(doc.plans.length ? "Listings you saved from Find" : doc.title, { kind: "serif", size: 20, color: C.ink, leading: 1.12, after: 10 });
    for (const resource of doc.saved) programCard(c, resource);
  }
  c.y += 4;
  helpBox(c);
  c.para("Program details were checked against public information on the date shown on each card. Confirm with the program before you go. Foster Guide is a directory, not legal advice, and nothing here is a promise of eligibility.", { size: 8.6, color: C.faint, leading: 1.4 });
  footer(c);
}
