import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ShieldCheck } from "lucide-react";
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
  content: "Hi, I'm Maya. Tell me what's going on and I'll look through the checked listings. No name needed.",
};

const STARTERS = [
  "Where can I sleep tonight?",
  "How do I get my birth certificate?",
  "Money for community college",
  "I'm turning 21 soon. What closes?",
];

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
 * The Maya conversation, rendered inline on the Ask page.
 *
 * Persists to sessionStorage so it survives navigation and clears with the
 * tab. Resources come back as in-app ResourceRows (never a full-page link),
 * so the conversation is never lost to a reload.
 */
export function MayaConversation({ className }: { className?: string }) {
  const { pendingPrompt, clearPendingPrompt } = useMaya();
  const [messages, setMessages] = useState<DisplayMessage[]>(loadStoredMessages);
  const historyTokenRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* fine */ }
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
        { role: "assistant", content: error instanceof Error ? error.message : "I'm unavailable right now. The checked directory still works from Find." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pendingPrompt) {
      clearPendingPrompt();
      void send(pendingPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const clearConversation = () => {
    setMessages([GREETING]);
    historyTokenRef.current = undefined;
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* fine */ }
    inputRef.current?.focus();
  };

  const fresh = messages.length === 1;

  return (
    <div className={cn("flex min-h-[60vh] flex-col", className)}>
      <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-6 lg:px-8">
        {messages.map((message, index) => (
          <div key={index} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-wrap text-[16px] leading-relaxed lg:max-w-[76%]",
                message.role === "user"
                  ? "rounded-[12px_12px_2px_12px] bg-ink px-4 py-3 text-on-deep"
                  : "rounded-[12px_12px_12px_2px] border border-rule bg-surface px-[18px] py-3.5 text-ink-body",
              )}
            >
              {message.degraded && (
                <p className="mb-1.5 text-[13px] font-medium text-crisis">I can&rsquo;t reach my assistant right now, so I searched the directory directly.</p>
              )}
              {message.content}
            </div>
            {message.crisisContacts && message.crisisContacts.length > 0 && (
              <div className="mt-2 w-full max-w-[88%] space-y-3 rounded-md border border-crisis/30 bg-crisis-soft p-4 lg:max-w-[76%]">
                {message.crisisContacts.map(contact => (
                  <div key={contact.id} className="text-sm">
                    <p className="font-semibold text-ink">{contact.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-ink-soft">
                      {contact.phone && (
                        <a href={`tel:${dialString(contact.phone)}`} className="font-semibold text-crisis underline underline-offset-2">{contact.phone}</a>
                      )}
                      {contact.text && <span>{contact.text}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {message.resources && message.resources.length > 0 && (
              <div className="mt-2 w-full max-w-[88%] rounded-md border border-rule bg-surface px-4 lg:max-w-[76%]">
                {message.resources.slice(0, 4).map(resource => (
                  <ResourceRow key={resource.id} resource={resource} dense />
                ))}
                <p className="py-2 text-[12px] text-ink-faint">Real listings from the directory, with the date each was checked.</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex w-fit items-center gap-2 rounded-md border border-rule bg-surface px-4 py-2.5 text-sm text-ink-faint">
            <Loader2 className="size-3.5 animate-spin" />
            Looking through checked listings&hellip;
          </div>
        )}
        {fresh && !loading && (
          <div className="mt-2 flex flex-wrap gap-2">
            {STARTERS.map(starter => (
              <button
                key={starter}
                type="button"
                onClick={() => void send(starter)}
                className="inline-flex min-h-10 items-center rounded-full border border-rule bg-surface px-3.5 text-[14px] font-medium text-ink-soft hover:border-ink hover:text-ink"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={event => { event.preventDefault(); void send(); }}
        className="border-t border-rule bg-surface px-4 pb-4 pt-3 lg:px-8"
      >
        <div className="flex items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink">
          <label htmlFor="maya-input" className="sr-only">What would help?</label>
          <input
            id="maya-input"
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="What would help?"
            className="h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-ink-body outline-none placeholder:text-ink-stamp"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="flex size-10 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-deep disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-faint">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" />Numbers and links are checked before you see them.</span>
          {!fresh && (
            <button type="button" onClick={clearConversation} className="text-brand hover:underline">Clear this conversation</button>
          )}
        </div>
      </form>
    </div>
  );
}
