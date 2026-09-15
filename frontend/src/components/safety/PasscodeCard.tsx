import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { adoptSession, fetchPasscodeStatus, fetchRoadmaps, forgetPasscode, restoreWithPasscode, setPasscode } from "@/lib/api";

/**
 * "Save this with a passcode" (Y6).
 *
 * Not an account: a few words the person chooses that open the same plan on
 * another device — their next phone, or a caseworker's laptop with them in
 * the room. Offered quietly from My plan and Privacy only; never a prompt.
 * Nothing about the passcode is stored in a form anyone can read back, so
 * there is no reset: forgetting it means the plan stays where it already is.
 */
export function PasscodeCard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const id = useId();
  const status = useQuery({ queryKey: ["passcode-status"], queryFn: fetchPasscodeStatus, retry: 1 });
  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps, retry: 1 });
  const [mode, setMode] = useState<"idle" | "set" | "open" | "forget">("idle");
  const [passcode, setPasscodeInput] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = status.data?.enabled === true;

  const reset = () => { setMode("idle"); setPasscodeInput(""); setAgain(""); setError(""); };

  const save = async () => {
    if (passcode !== again) { setError("The two entries don't match."); return; }
    setBusy(true); setError("");
    try {
      await setPasscode(passcode);
      await queryClient.invalidateQueries({ queryKey: ["passcode-status"] });
      toast.success("Saved. Your passcode opens this plan on another device.");
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that just now.");
    } finally { setBusy(false); }
  };

  const open = async () => {
    setBusy(true); setError("");
    try {
      const found = await restoreWithPasscode(passcode);
      if (roadmaps.length > 0 && !window.confirm("This browser already has a plan. Opening the other one puts this plan aside (it is not deleted). Continue?")) { setBusy(false); return; }
      adoptSession(found.sessionId);
      toast.success(found.plans ? "Found it. Opening your plan…" : "Found it. That passcode has no plan yet.");
      window.setTimeout(() => window.location.assign(`${import.meta.env.BASE_URL}roadmap`), 400);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check that just now.");
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    try {
      await forgetPasscode();
      await queryClient.invalidateQueries({ queryKey: ["passcode-status"] });
      toast.success("Passcode forgotten. Your plan stays on this device.");
      reset();
    } catch { toast.error("Could not do that just now."); }
    finally { setBusy(false); }
  };

  const inputClass = "mt-1.5 h-11 rounded-md border-rule bg-surface text-[15px]";
  const button = "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-ink px-3.5 text-[14px] font-semibold text-ink hover:bg-surface disabled:opacity-50";
  const quiet = "inline-flex min-h-10 items-center text-[14px] text-ink-soft hover:text-ink hover:underline";

  return (
    <section aria-labelledby={`${id}-h`} className={compact ? "text-[14px] leading-relaxed" : "rounded-md border border-rule bg-surface p-6"}>
      <h2 id={`${id}-h`} className={compact ? "inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink" : "inline-flex items-center gap-2 font-display text-[22px] font-bold text-ink"}>
        <KeyRound className={compact ? "size-4 text-brand" : "size-5 text-brand"} /> {enabled ? "Saved with a passcode" : "Want this on another device?"}
      </h2>
      {mode === "idle" && (
        <>
          <p className={compact ? "mt-1 text-ink-faint" : "mt-2 text-[15px] leading-relaxed text-ink-soft"}>
            {enabled
              ? "Type your passcode on any phone or computer, at Foster Connect → My plan, to open this same plan there. Only you know it; it can't be reset."
              : "Optional. Pick a few words only you know, and this plan opens on your next phone or on a caseworker's computer with you there. No email, no account, no reminders."}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {enabled
              ? <button type="button" onClick={() => setMode("forget")} className={quiet}>Forget the passcode</button>
              : <button type="button" onClick={() => setMode("set")} className={quiet}>Save this with a passcode</button>}
            <button type="button" onClick={() => setMode("open")} className={quiet}>Have a passcode from another device? Open it here</button>
          </div>
        </>
      )}
      {mode === "set" && (
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="mt-3 flex max-w-[420px] flex-col gap-3">
          <p className="text-[14px] text-ink-soft">At least 8 characters. Three or four words you&rsquo;ll remember work best &mdash; capitals and extra spaces don&rsquo;t matter. There is no reset, so pick something that stays with you.</p>
          <div><label htmlFor={`${id}-p`} className="text-[13px] font-semibold text-ink-soft">Passcode</label><Input id={`${id}-p`} type="password" autoComplete="new-password" value={passcode} onChange={event => setPasscodeInput(event.target.value)} className={inputClass} /></div>
          <div><label htmlFor={`${id}-a`} className="text-[13px] font-semibold text-ink-soft">Type it again</label><Input id={`${id}-a`} type="password" autoComplete="new-password" value={again} onChange={event => setAgain(event.target.value)} className={inputClass} /></div>
          {error && <p role="alert" className="text-[14px] text-crisis">{error}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy || passcode.length < 8} className={button}>{busy && <Loader2 className="size-4 animate-spin" />} Save passcode</button>
            <button type="button" onClick={reset} className={quiet}>Never mind</button>
          </div>
        </form>
      )}
      {mode === "open" && (
        <form onSubmit={event => { event.preventDefault(); void open(); }} className="mt-3 flex max-w-[420px] flex-col gap-3">
          <div><label htmlFor={`${id}-o`} className="text-[13px] font-semibold text-ink-soft">Passcode from the other device</label><Input id={`${id}-o`} type="password" autoComplete="current-password" value={passcode} onChange={event => setPasscodeInput(event.target.value)} className={inputClass} /></div>
          {roadmaps.length > 0 && <p className="text-[13px] text-ink-faint">This browser already has a plan. Opening another puts it aside; nothing is deleted.</p>}
          {error && <p role="alert" className="text-[14px] text-crisis">{error}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy || !passcode.trim()} className={button}>{busy && <Loader2 className="size-4 animate-spin" />} Open my plan</button>
            <button type="button" onClick={reset} className={quiet}>Never mind</button>
          </div>
        </form>
      )}
      {mode === "forget" && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px]">
          <span className="text-ink-soft">Forget it? The passcode stops working everywhere. This plan stays on this device.</span>
          <button type="button" onClick={() => void forget()} disabled={busy} className="font-semibold text-crisis hover:underline">Yes, forget it</button>
          <button type="button" onClick={reset} className={quiet}>Keep it</button>
        </div>
      )}
    </section>
  );
}
