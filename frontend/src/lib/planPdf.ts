import { jsPDF } from "jspdf";
import { fetchRoadmap, fetchRoadmaps, fetchSavedResources, type ResourceItem, type Roadmap } from "@/lib/api";
import { renderPdf, type PdfFonts } from "@/lib/planPdfRender";

/**
 * "Take a copy with you" as a PDF: the plan as a real checklist with the
 * program behind each step, then saved listings as cards with everything
 * needed to act. Built in the browser from the same data the pages show;
 * nothing is sent anywhere. Layout lives in planPdfRender.ts.
 */

/** Site fonts, fetched only for this download and embedded so the PDF matches the site. */
async function loadFonts(): Promise<PdfFonts> {
  const base = `${import.meta.env.BASE_URL}fonts/`;
  const fetchOne = async (file: string) => {
    const response = await fetch(base + file);
    if (!response.ok) throw new Error(file);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  try {
    const [sans, sansSemibold, serifBold] = await Promise.all([fetchOne("SourceSans3-Regular.ttf"), fetchOne("SourceSans3-Semibold.ttf"), fetchOne("SourceSerif4-Bold.ttf")]);
    return { sans, sansSemibold, serifBold };
  } catch {
    return {}; // Helvetica fallback; the layout is the same.
  }
}

/** Everything this session holds, as one PDF. Returns the number of plans and saved listings included. */
export async function downloadMyDataPdf(): Promise<{ plans: number; saved: number }> {
  const [list, saved, fonts] = await Promise.all([fetchRoadmaps(), fetchSavedResources().catch(() => [] as ResourceItem[]), loadFonts()]);
  const plans = await Promise.all(list.map(item => fetchRoadmap(item.id)));
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  renderPdf(pdf, { title: "My plan and saved programs", plans, saved, generatedAt: new Date() }, fonts);
  pdf.save(`foster-guide-my-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
  return { plans: plans.length, saved: saved.length };
}

/** One plan only, from the My plan page. */
export async function downloadPlanPdf(plan: Roadmap) {
  const fonts = await loadFonts();
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  renderPdf(pdf, { title: plan.title || "My plan", plans: [plan], saved: [], generatedAt: new Date() }, fonts);
  pdf.save(`foster-guide-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
}
