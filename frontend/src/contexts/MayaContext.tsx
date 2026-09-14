import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface MayaContextValue {
  /** Text queued as the next message Maya should be asked, e.g. from a plan step's "Ask Maya" button. */
  pendingPrompt: string | null;
  /** Go to the Ask page, optionally with a message to send on arrival. */
  openMaya: (prompt?: string) => void;
  clearPendingPrompt: () => void;
}

const MayaContext = createContext<MayaContextValue | null>(null);

/**
 * Maya is a page (/ask) in the redesign rather than an overlay, so "open"
 * means navigate. The pending prompt survives the navigation in context.
 */
export function MayaProvider({ children }: { children: ReactNode }) {
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const navigate = useNavigate();

  const value = useMemo<MayaContextValue>(() => ({
    pendingPrompt,
    openMaya: prompt => { setPendingPrompt(prompt ?? null); navigate("/ask"); },
    clearPendingPrompt: () => setPendingPrompt(null),
  }), [pendingPrompt, navigate]);

  return <MayaContext.Provider value={value}>{children}</MayaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives beside its provider intentionally
export function useMaya() {
  const context = useContext(MayaContext);
  if (!context) throw new Error("useMaya must be used within a MayaProvider");
  return context;
}
