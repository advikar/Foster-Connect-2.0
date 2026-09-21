import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasscodeCard } from "@/components/safety/PasscodeCard";
import { deleteSessionData, exportSessionData } from "@/lib/api";
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
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    try {
      const data = await exportSessionData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "foster-connect-my-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build the download just now. Try again in a moment.");
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteSessionData();
      toast.success("Your session data and saved conversations have been deleted.");
      window.location.assign(import.meta.env.BASE_URL);
    } catch {
      toast.error("Couldn't delete that just now. Try again in a moment.");
      setBusy(false);
    }
  };

  return (
    <div className="container-wide"><div className="max-w-[760px] pb-16 pt-8 lg:pt-12">
      <h1 className="text-display text-ink">Your data</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        You can browse without an account. This page explains how plans, preferences and
        conversations are handled, and how to download or delete your session data.
      </p>

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
              you may lose access unless you set a recovery passcode (below).
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>
              Messages to Nova are sent through our server to an AI provider to generate replies.
              Saved conversations are kept in this browser. Deleting them here does not establish that
              the AI provider has deleted its records. Avoid including names, addresses or other identifying details.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>Homepage preferences are saved in this browser. Age and county filters may be sent in resource requests. Clear these choices using “Clear” in the homepage preferences; deleting session data below does not clear them.</span>
          </li>
        </ul>
      </section>

      <div className="mt-9"><PasscodeCard /></div>

      <section className="mt-9 rounded-md bg-sand-soft p-6">
        <h2 className="font-display text-[22px] font-bold text-ink">
          On a library or shared computer?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Closing the tab does not remove saved access from this browser. Someone using the same
          browser profile may be able to open your plan or conversations. Review the deletion options below
          and clear your homepage preferences before leaving a shared computer.
        </p>
      </section>

      <section className="mt-9 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-rule bg-surface p-6">
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink">Take a copy with you</h2>
            <p className="mt-1 text-sm text-ink-soft">Your plan and saved resources, as a file.</p>
          </div>
          <Button onClick={exportData} variant="outline" className="h-11 rounded-md border-rule px-5">
            <Download className="size-4" />
            Download
          </Button>
        </div>

        <div className="rounded-md border border-crisis/25 bg-crisis-soft p-6">
          <h2 className="font-display text-[20px] font-bold text-ink">Delete session data</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Deletes your plan, notes and saved resources from our database, and removes this browser’s session ID and saved conversations. Homepage preferences are separate.
            This can&apos;t be undone.
          </p>
          {confirming ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={remove} disabled={busy} className="h-11 rounded-md bg-crisis px-5 text-white hover:opacity-90">
                <Trash2 className="size-4" />
                {busy ? "Deleting" : "Yes, delete session data"}
              </Button>
              <Button onClick={() => setConfirming(false)} variant="outline" className="h-11 rounded-md border-rule px-5">
                Never mind
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setConfirming(true)}
              variant="outline"
              className="mt-4 h-11 rounded-md border-crisis/30 px-5 text-crisis hover:bg-crisis/5"
            >
              <Trash2 className="size-4" />
              Delete my data
            </Button>
          )}
        </div>
      </section>
    </div></div>
  );
}
