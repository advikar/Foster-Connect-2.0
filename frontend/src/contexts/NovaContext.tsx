import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface NovaContextValue {
  /** Text queued as the next message Nova should be asked, e.g. from a plan step's "Ask Nova" button. */
  pendingPrompt: string | null;
  /** Go to the Ask page, optionally with a message to send on arrival. */
  openNova: (prompt?: string) => void;
  clearPendingPrompt: () => void;
}

const NovaContext = createContext<NovaContextValue | null>(null);

/**
 * Nova is a page (/ask) in the redesign rather than an overlay, so "open"
 * means navigate. The pending prompt survives the navigation in context.
 */
export function NovaProvider({ children }: { children: ReactNode }) {
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const navigate = useNavigate();

  const value = useMemo<NovaContextValue>(() => ({
    pendingPrompt,
    openNova: prompt => { setPendingPrompt(prompt ?? null); navigate("/ask"); },
    clearPendingPrompt: () => setPendingPrompt(null),
  }), [pendingPrompt, navigate]);

  return <NovaContext.Provider value={value}>{children}</NovaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives beside its provider intentionally
export function useNova() {
  const context = useContext(NovaContext);
  if (!context) throw new Error("useNova must be used within a NovaProvider");
  return context;
}
