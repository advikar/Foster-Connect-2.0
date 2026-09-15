import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MessageSquarePlus, Send, ShieldCheck } from "lucide-react";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useMaya } from "@/contexts/MayaContext";
import { MAYA_ARCHIVE_KEY, MAYA_CONVERSATION_KEY, sendChat, type ChatMessageInput, type CrisisContact, type ResourceItem } from "@/lib/api";
import { dialString } from "@/lib/crisis";
import { cn } from "@/lib/utils";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  resources?: ResourceItem[];
  crisisContacts?: CrisisContact[];
  degraded?: boolean;
  /** A network/app failure, not something Maya said. Never sent back as history. */
  error?: boolean;
}

/**
 * What survives navigation and reloads. `history` and `historyToken` are the
 * server's own signed record of the conversation — the display list is for
 * people, the signed list is what the model is allowed to remember.
 */
interface StoredConversation {
  messages: DisplayMessage[];
  history: ChatMessageInput[];
  historyToken?: string;
}

/** A past chat, kept on this device until cleared (Y9). Costs nothing: Maya is only called when a message is sent. */
interface ArchivedConversation extends StoredConversation {
  id: string;
  title: string;
  savedAt: string;
}
const MAX_ARCHIVED = 5;

function loadArchive(): ArchivedConversation[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MAYA_ARCHIVE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => item && Array.isArray(item.messages)) : [];
  } catch { return []; }
}
function saveArchive(items: ArchivedConversation[]) {
  try {
    if (items.length) window.localStorage.setItem(MAYA_ARCHIVE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(MAYA_ARCHIVE_KEY);
  } catch { /* fine */ }
}
function titleOf(conversation: StoredConversation) {
  const first = conversation.messages.find(message => message.role === "user")?.content ?? "Chat";
  return first.length > 60 ? `${first.slice(0, 57)}…` : first;
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

const EMPTY: StoredConversation = { messages: [GREETING], history: [] };

function loadConversation(): StoredConversation {
  try {
    const raw = window.localStorage.getItem(MAYA_CONVERSATION_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredConversation>;
    if (!Array.isArray(parsed.messages) || !parsed.messages.length) return EMPTY;
    return { messages: parsed.messages, history: Array.isArray(parsed.history) ? parsed.history : [], historyToken: parsed.historyToken };
  } catch {
    return EMPTY;
  }
}

/**
 * The Maya conversation, rendered inline on the Ask page.
 *
 * Kept in localStorage — with the server-signed history — so Maya remembers
 * the thread across pages and reloads until the person clears it (or uses
 * "Delete my data"). Resources come back as in-app ResourceRows (never a
 * full-page link), so the conversation is never lost to a reload.
 */
export function MayaConversation({ className }: { className?: string }) {
  const { pendingPrompt, clearPendingPrompt } = useMaya();
  const [conversation, setConversation] = useState<StoredConversation>(loadConversation);
  const [archive, setArchive] = useState<ArchivedConversation[]>(loadArchive);
  const [pastOpen, setPastOpen] = useState(false);
  const { messages, history, historyToken } = conversation;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (messages.length <= 1) window.localStorage.removeItem(MAYA_CONVERSATION_KEY);
      else window.localStorage.setItem(MAYA_CONVERSATION_KEY, JSON.stringify(conversation));
    } catch { /* private mode: the thread lives for this page only */ }
  }, [conversation, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  const send = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || loading) return;
    setConversation(previous => ({ ...previous, messages: [...previous.messages, { role: "user", content: message }] }));
    setInput("");
    setLoading(true);
    try {
      const response = await sendChat(message, history, { historyToken });
      setConversation(previous => ({
        messages: [
          ...previous.messages,
          { role: "assistant", content: response.reply, resources: response.resources, crisisContacts: response.crisisContacts, degraded: response.degraded },
        ],
        history: response.history ?? previous.history,
        historyToken: response.historyToken ?? previous.historyToken,
      }));
    } catch (error) {
      setConversation(previous => ({
        ...previous,
        messages: [
          ...previous.messages,
          { role: "assistant", error: true, content: error instanceof Error ? error.message : "I'm unavailable right now. The checked directory still works from Find." },
        ],
      }));
    } finally {
      setLoading(false);
      inputRef.current?.focus({ preventScroll: true });
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
    setConversation(EMPTY);
    try { window.localStorage.removeItem(MAYA_CONVERSATION_KEY); } catch { /* fine */ }
    inputRef.current?.focus();
  };

  const fresh = messages.length === 1;

  /** Put the current thread away (keeping its signed history) and start clean. */
  const archiveCurrent = (): ArchivedConversation[] => {
    if (fresh) return archive;
    const entry: ArchivedConversation = { ...conversation, id: `${Date.now()}`, title: titleOf(conversation), savedAt: new Date().toISOString() };
    return [entry, ...archive].slice(0, MAX_ARCHIVED);
  };
  const newChat = () => {
    const next = archiveCurrent();
    setArchive(next); saveArchive(next);
    clearConversation();
  };
  const reopen = (item: ArchivedConversation) => {
    const kept = archiveCurrent().filter(entry => entry.id !== item.id);
    setArchive(kept); saveArchive(kept);
    setConversation({ messages: item.messages, history: item.history, historyToken: item.historyToken });
    setPastOpen(false);
  };
  const forgetPast = () => { setArchive([]); saveArchive([]); setPastOpen(false); };

  return (
    <div className={cn("flex min-h-[60vh] flex-col", className)}>
      {(archive.length > 0 || !fresh) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2 text-[13px] lg:px-8">
          {archive.length > 0 ? (
            <button type="button" onClick={() => setPastOpen(value => !value)} aria-expanded={pastOpen} className="inline-flex min-h-9 items-center gap-1 text-ink-soft hover:text-ink">
              Past chats · {archive.length} <ChevronDown className={cn("size-4 transition-transform", pastOpen && "rotate-180")} />
            </button>
          ) : <span />}
          {!fresh && (
            <button type="button" onClick={newChat} className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-brand hover:underline">
              <MessageSquarePlus className="size-4" /> New chat
            </button>
          )}
        </div>
      )}
      {pastOpen && archive.length > 0 && (
        <div className="border-b border-rule bg-sunk px-4 py-3 lg:px-8">
          <ul className="divide-y divide-rule">
            {archive.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => reopen(item)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-medium text-ink">{item.title}</p>
                  <p className="text-[12px] text-ink-faint">{new Date(item.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {Math.max(item.messages.length - 1, 0)} messages · Maya remembers it</p>
                </button>
                <span className="text-[13px] text-brand">Open</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={forgetPast} className="mt-2 text-[13px] text-ink-faint hover:text-crisis hover:underline">Delete all past chats</button>
        </div>
      )}
      <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-6 lg:px-8">
        {messages.map((message, index) => (
          <div key={index} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-wrap text-[16px] leading-relaxed lg:max-w-[76%]",
                message.role === "user"
                  ? "rounded-[12px_12px_2px_12px] bg-ink px-4 py-3 text-on-deep"
                  : "rounded-[12px_12px_12px_2px] border border-rule bg-surface px-[18px] py-3.5 text-ink-body",
                message.error && "border-crisis/40 text-crisis",
              )}
            >
              {message.degraded && (
                <p className="mb-1.5 text-[13px] font-medium text-crisis">Directory search only — the AI guide is unavailable right now.</p>
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
        <div ref={endRef} />
      </div>

      <form
        onSubmit={event => { event.preventDefault(); void send(); }}
        className="sticky bottom-[72px] border-t border-rule bg-surface px-4 pb-4 pt-3 lg:bottom-0 lg:px-8"
      >
        <div className="flex items-center gap-2 rounded-md border border-rule bg-surface pl-4 pr-1.5 focus-within:border-ink">
          <label htmlFor="maya-input" className="sr-only">What would help?</label>
          <input
            id="maya-input"
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={fresh ? "What would help?" : "Reply to Maya…"}
            className="h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-ink-body outline-none placeholder:text-ink-stamp"
            autoComplete="off"
            enterKeyHint="send"
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
