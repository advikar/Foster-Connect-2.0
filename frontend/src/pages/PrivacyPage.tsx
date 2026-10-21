import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasscodeCard } from "@/components/safety/PasscodeCard";
import { CONTACT_EMAIL } from "@/lib/contact";
import { clearDeviceData, deleteSessionData, exportSessionData, fetchPasscodeStatus, setPasscode } from "@/lib/api";
import { toast } from "sonner";

/**
 * Your data.
 *
 * Written for young people and community partners. Every claim
 * here has to stay true — if the storage model changes, this page changes
 * with it.
 *
 * The shared-computer section exists because a public library or shelter
 * machine is a primary access route for this audience, and the session id
 * lives in localStorage, which outlives closing the tab (audit U-01).
 */
export function PrivacyPage() {
  usePageMeta("Your data", "What Foster Guide stores, how to take a copy, clear a device, or delete everything.", "/privacy");
  const queryClient = useQueryClient();
  const passcode = useQuery({ queryKey: ["passcode-status"], queryFn: fetchPasscodeStatus, retry: 1 });
  const hasPasscode = passcode.data?.enabled === true;
  const [exporting, setExporting] = useState(false);
  // "Clear from this device": idle → (no passcode) offer to set one → confirm → done.
  const [clearing, setClearing] = useState<"idle" | "passcode" | "confirm">("idle");
  const [newPasscode, setNewPasscode] = useState("");
  const [newPasscodeAgain, setNewPasscodeAgain] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  // "Delete everything": two steps, the second needs a typed word.
  const [deleting, setDeleting] = useState<"idle" | "first" | "second">("idle");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      // The PDF library loads only when someone asks for the file.
      const { downloadMyDataPdf } = await import("@/lib/planPdf");
      const { plans, saved } = await downloadMyDataPdf();
      toast.success(plans || saved ? "Your PDF is downloading." : "Nothing saved yet, so the PDF explains that.");
    } catch {
      toast.error("Couldn't build the PDF just now. Try again in a moment.");
    } finally { setExporting(false); }
  };

  const exportRaw = async () => {
    try {
      const data = await exportSessionData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "foster-guide-raw-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build the download just now. Try again in a moment.");
    }
  };

  const startClear = () => setClearing(hasPasscode ? "confirm" : "passcode");
  const savePasscodeThenClear = async () => {
    if (newPasscode !== newPasscodeAgain) { setPasscodeError("The two entries don't match."); return; }
    setBusy(true); setPasscodeError("");
    try {
      await setPasscode(newPasscode);
      await queryClient.invalidateQueries({ queryKey: ["passcode-status"] });
      setNewPasscode(""); setNewPasscodeAgain("");
      setClearing("confirm");
    } catch (caught) {
      setPasscodeError(caught instanceof Error ? caught.message : "Could not save that just now.");
    } finally { setBusy(false); }
  };
  const clearDevice = () => {
    clearDeviceData();
    toast.success(hasPasscode ? "Cleared from this device. Your passcode opens your plan again on any device." : "Cleared from this device.");
    window.location.assign(import.meta.env.BASE_URL);
  };

  const deleteEverything = async () => {
    setBusy(true);
    try {
      await deleteSessionData();
      toast.success("Everything was deleted. There is nothing left to restore.");
      window.location.assign(import.meta.env.BASE_URL);
    } catch {
      toast.error("Couldn't delete that just now. Try again in a moment.");
      setBusy(false);
    }
  };

  const inputClass = "mt-1.5 h-11 rounded-md border-rule bg-surface text-[15px]";

  return (
    <div className="container-wide"><div className="max-w-[760px] pb-16 pt-8 lg:pt-12">
      <h1 className="text-display text-ink">Your data</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        No account is needed. Here you can save your plan to use on another device (with a passcode), download a copy,
        clear this device, or delete everything. Further down: what is stored and who handles it.
      </p>
      <p className="mt-2 text-[14px] text-ink-faint">Last updated September 28, 2026.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-faint">
        <span className="font-semibold text-ink-soft">Disclaimer:</span> Foster Guide is a directory, not legal, medical or financial advice. Listings are checked against public information and can change. Confirm details with the program before you rely on them.
      </p>

      <div className="mt-8"><PasscodeCard /></div>

      <section className="mt-9 rounded-md bg-sand-soft p-6">
        <h2 className="font-display text-[22px] font-bold text-ink">
          On a library or shared computer?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Closing the tab does not remove saved access from this browser. Someone using the same
          browser profile may be able to open your plan or conversations. Before you leave, use
          &ldquo;Clear from this device&rdquo; (your plan stays saved for your passcode) and clear your homepage preferences.
        </p>
      </section>

      <section className="mt-9 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-rule bg-surface p-6">
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink">Take a copy with you</h2>
            <p className="mt-1 text-sm text-ink-soft">Your plan, every step, and your saved programs with phone numbers and how to start, as a PDF you can print or send to yourself.</p>
            <button type="button" onClick={exportRaw} className="mt-2 text-[12px] text-ink-faint hover:text-ink hover:underline">Raw data file (JSON) instead</button>
          </div>
          <Button onClick={exportData} disabled={exporting} variant="outline" className="h-11 rounded-md border-rule px-5">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            {exporting ? "Building" : "Download PDF"}
          </Button>
        </div>

        <div className="rounded-md border border-rule bg-surface p-6">
          <h2 className="inline-flex items-center gap-2 font-display text-[20px] font-bold text-ink"><Eraser className="size-5 text-brand" /> Clear from this device</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Removes your session ID, Nova conversations and homepage preferences from this browser, so nobody using it after you can open your plan.
            Your plan and saved programs stay on our server; a passcode opens them again on any device. Good for a library or shared computer.
          </p>
          {clearing === "idle" && (
            <Button onClick={startClear} variant="outline" className="mt-4 h-11 rounded-md border-ink px-5">
              <Eraser className="size-4" /> Clear from this device
            </Button>
          )}
          {clearing === "passcode" && (
            <form onSubmit={event => { event.preventDefault(); void savePasscodeThenClear(); }} className="mt-4 flex max-w-[420px] flex-col gap-3 rounded-md bg-sand-soft p-4">
              <p className="text-[14px] font-semibold text-ink">Set a passcode first, so you can get back to your plan.</p>
              <p className="text-[13px] text-ink-soft">Without one, clearing this device means nobody, including you, can open this plan again. At least 8 characters; a few words you&apos;ll remember. There is no reset.</p>
              <div><label htmlFor="clear-p" className="text-[13px] font-semibold text-ink-soft">Passcode</label><Input id="clear-p" type="password" autoComplete="new-password" value={newPasscode} onChange={event => setNewPasscode(event.target.value)} className={inputClass} /></div>
              <div><label htmlFor="clear-p2" className="text-[13px] font-semibold text-ink-soft">Type it again</label><Input id="clear-p2" type="password" autoComplete="new-password" value={newPasscodeAgain} onChange={event => setNewPasscodeAgain(event.target.value)} className={inputClass} /></div>
              {passcodeError && <p role="alert" className="text-[13px] text-crisis">{passcodeError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || newPasscode.length < 8} className="h-11 rounded-md bg-brand px-5 text-white hover:bg-brand-deep">{busy && <Loader2 className="size-4 animate-spin" />} Save passcode and continue</Button>
                <Button type="button" onClick={() => setClearing("confirm")} variant="outline" className="h-11 rounded-md border-rule px-5">Clear without a passcode</Button>
                <Button type="button" onClick={() => setClearing("idle")} variant="ghost" className="h-11 rounded-md px-4">Never mind</Button>
              </div>
            </form>
          )}
          {clearing === "confirm" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="w-full text-[14px] text-ink-soft">{hasPasscode ? "Your passcode will open this plan again. Clear this device now?" : "No passcode is set, so this plan cannot be opened again after clearing. Clear anyway?"}</p>
              <Button onClick={clearDevice} className="h-11 rounded-md bg-ink px-5 text-white hover:opacity-90"><Eraser className="size-4" /> Yes, clear this device</Button>
              <Button onClick={() => setClearing("idle")} variant="outline" className="h-11 rounded-md border-rule px-5">Never mind</Button>
            </div>
          )}
        </div>

        <div className="rounded-md border border-crisis/25 bg-crisis-soft p-6">
          <h2 className="font-display text-[20px] font-bold text-ink">Delete everything</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Permanently deletes your plan, notes, saved programs and passcode from our server, and clears this browser. A passcode will not bring it back and we cannot undo it. Routine server backups age out on their own; the AI provider&rsquo;s own records are covered by its policy, not by this button.
          </p>
          {deleting === "idle" && (
            <Button onClick={() => setDeleting("first")} variant="outline" className="mt-4 h-11 rounded-md border-crisis/30 px-5 text-crisis hover:bg-crisis/5">
              <Trash2 className="size-4" /> Delete everything
            </Button>
          )}
          {deleting === "first" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="w-full text-[14px] text-ink-soft">Are you sure? If you only want to hide your plan on this computer, use &ldquo;Clear from this device&rdquo; above instead. Want a copy first? <button type="button" onClick={exportData} className="font-semibold text-brand hover:underline">Download the PDF</button>.</p>
              <Button onClick={() => setDeleting("second")} variant="outline" className="h-11 rounded-md border-crisis/40 px-5 text-crisis hover:bg-crisis/5">Yes, I want to delete everything</Button>
              <Button onClick={() => setDeleting("idle")} variant="outline" className="h-11 rounded-md border-rule px-5">Never mind</Button>
            </div>
          )}
          {deleting === "second" && (
            <form onSubmit={event => { event.preventDefault(); if (typed.trim().toUpperCase() === "DELETE") void deleteEverything(); }} className="mt-4 flex max-w-[420px] flex-col gap-3">
              <label htmlFor="delete-word" className="text-[14px] text-ink-soft">Last check. Type <span className="font-semibold text-ink">DELETE</span> to confirm. This cannot be undone.</label>
              <Input id="delete-word" value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" className={inputClass} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || typed.trim().toUpperCase() !== "DELETE"} className="h-11 rounded-md bg-crisis px-5 text-white hover:opacity-90">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  {busy ? "Deleting" : "Delete everything, permanently"}
                </Button>
                <Button type="button" onClick={() => { setDeleting("idle"); setTyped(""); }} variant="outline" className="h-11 rounded-md border-rule px-5">Never mind</Button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-display text-[22px] font-bold text-ink">What&apos;s actually stored</h2>
        <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>Your plan, which steps you&apos;ve marked done, any notes you added, and anything you saved.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>
              Plans and saved resources are stored on our server under a random session ID kept in this browser.
              Information you enter may identify you, even without an account. If you clear your browser,
              you may lose access unless you set a passcode (above).
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>
              Messages to Nova are sent through our server to Groq, the AI provider, to generate replies.
              Your session ID is not sent with them. Saved conversations are kept in this browser. Deleting them here does not establish that
              Groq has deleted its records. Avoid including names, addresses or other identifying details.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>Homepage preferences are saved in this browser. Age and county filters may be sent in resource requests. “Clear from this device” and “Delete everything” above remove them, as does “Clear” in the homepage preferences.</span>
          </li>
        </ul>
      </section>

      <section className="mt-9">
        <h2 className="font-display text-[22px] font-bold text-ink">Who handles it</h2>
        <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span><span className="font-semibold text-ink">Render</span> hosts the site and the server, in the United States. Like any web host it keeps short-lived server logs that include IP addresses.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span><span className="font-semibold text-ink">Turso</span> stores the database: plans, saved programs, passcodes (hashed) and the directory itself.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span><span className="font-semibold text-ink">Groq</span> generates Nova&apos;s replies from the message you send and the listings we attach.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span><span className="font-semibold text-ink">GoatCounter</span> counts page views so we know which pages help: the page path, the site you came from, your screen size and browser type. It sets no cookies, stores no identifiers, and never sees what you search or type. There are no youth accounts and no advertising trackers. Nothing is sold or shared beyond the four services above.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>Questions, or a deletion request you cannot complete from this page: <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a>. Not for emergencies.</span>
          </li>
        </ul>
      </section>
    </div></div>
  );
}
