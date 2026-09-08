import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useMaya } from "@/contexts/MayaContext";
import { sendChat, type ChatMessageInput, type CrisisContact, type ResourceItem } from "@/lib/api";
import { dialString } from "@/lib/crisis";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "fc-maya-messages";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  resources?: ResourceItem[];
  crisisContacts?: CrisisContact[];
  degraded?: boolean;
}

const GREETING: DisplayMessage = {
  role: "assistant",
  content: "Hi, I'm Maya. Tell me what's going on, and I'll use verified Foster Connect resources whenever there's a good match.",
};

function loadStoredMessages(): DisplayMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [GREETING];
  } catch {
    return [GREETING];
  }
}

/**
 * Maya — full screen, not a floating bubble.
 *
 * On a phone the conversation deserves the whole screen. Persists to
 * sessionStorage (audit U-06 fix: the old chat used <a href> for resource
 * links, which triggered a full page reload and lost the conversation —
 * this renders resources as in-app ResourceRows and never navigates away).
 */
export function MayaOverlay() {
  const { open, pendingPrompt, closeMaya, clearPendingPrompt } = useMaya();
  const [messages, setMessages] = useState<DisplayMessage[]>(loadStoredMessages);
  /**
   * Proof the server produced the history we hold. Sent back on every turn;
   * without it the server discards the history rather than trust the browser.
   * Deliberately kept in memory only — a token restored from storage would be
   * stale after a restart, and the server drops those safely anyway.
   */
  const historyTokenRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // sessionStorage can be unavailable (private browsing, quota). The
      // conversation still works for this screen session either way.
    }
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || loading) return;
    const history: ChatMessageInput[] = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(previous => [...previous, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    try {
      const response = await sendChat(message, history, { historyToken: historyTokenRef.current });
      historyTokenRef.current = response.historyToken;
      setMessages(previous => [
        ...previous,
        { role: "assistant", content: response.reply, resources: response.resources, crisisContacts: response.crisisContacts, degraded: response.degraded },
      ]);
    } catch (error) {
      setMessages(previous => [
        ...previous,
        { role: "assistant", content: error instanceof Error ? error.message : "I'm unavailable right now. The verified directory still works from Find." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && pendingPrompt) {
      clearPendingPrompt();
      void send(pendingPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Conversation with Maya">
      <header className="flex shrink-0 items-center justify-between border-b border-rule px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand text-white">
            <Bot className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Maya &middot; Navigator</p>
            <p className="text-[11px] text-ink-faint">AI &middot; facts come from checked listings</p>
          </div>
        </div>
        <button type="button" onClick={closeMaya} aria-label="Close conversation with Maya" className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-sunk">
          <X className="size-5" />
        </button>
      </header>

      <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-ground px-4 py-4">
        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                message.role === "user" ? "ml-auto rounded-br-sm bg-brand text-white" : "rounded-bl-sm border border-rule bg-surface text-ink",
              )}
            >
              {message.degraded && (
                <p className="mb-1.5 text-xs font-medium text-warm">I can&apos;t reach my assistant right now, so I searched the directory directly.</p>
              )}
              {message.content}
            </div>
            {message.crisisContacts && message.crisisContacts.length > 0 && (
              <div className="mt-2 space-y-2 rounded-2xl border border-crisis/25 bg-crisis-soft p-3">
                {message.crisisContacts.map(contact => (
                  <div key={contact.id} className="text-sm">
                    <p className="font-semibold text-ink">{contact.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-ink-soft">
                      {contact.phone && (
                        <a href={`tel:${dialString(contact.phone)}`} className="font-medium text-crisis underline underline-offset-2">
                          {contact.phone}
                        </a>
                      )}
                      {contact.text && <span>{contact.text}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {message.resources && message.resources.length > 0 && (
              <div className="mt-2 divide-y divide-rule-soft rounded-2xl border border-rule bg-surface px-3">
                {message.resources.slice(0, 4).map(resource => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex w-fit items-center gap-2 rounded-2xl border border-rule bg-surface px-4 py-2.5 text-sm text-ink-faint">
            <Loader2 className="size-3.5 animate-spin" />
            Looking through verified resources&hellip;
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-rule bg-surface p-3 pb-safe">
        <div className="flex gap-2">
          <label htmlFor="maya-input" className="sr-only">What would help?</label>
          <Input
            id="maya-input"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => event.key === "Enter" && void send()}
            placeholder="What would help?"
            className="h-12 rounded-xl border-rule"
          />
          <Button onClick={() => void send()} disabled={loading} size="icon" className="size-12 shrink-0 rounded-xl bg-brand hover:bg-brand/90" aria-label="Send">
            <Send className="size-4.5" />
          </Button>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-faint">
          <ShieldCheck className="size-3" />
          Numbers and links are checked before you see them
        </p>
      </div>
    </div>
  );
}
