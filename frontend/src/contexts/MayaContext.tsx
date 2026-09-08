import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface MayaContextValue {
  open: boolean;
  /** Optional text queued as the next message Maya should be asked, e.g. from a roadmap step's "Ask Maya" button. */
  pendingPrompt: string | null;
  openMaya: (prompt?: string) => void;
  closeMaya: () => void;
  clearPendingPrompt: () => void;
}

const MayaContext = createContext<MayaContextValue | null>(null);

export function MayaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const value = useMemo<MayaContextValue>(() => ({
    open,
    pendingPrompt,
    openMaya: prompt => { setPendingPrompt(prompt ?? null); setOpen(true); },
    closeMaya: () => setOpen(false),
    clearPendingPrompt: () => setPendingPrompt(null),
  }), [open, pendingPrompt]);

  return <MayaContext.Provider value={value}>{children}</MayaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives beside its provider intentionally
export function useMaya() {
  const context = useContext(MayaContext);
  if (!context) throw new Error("useMaya must be used within a MayaProvider");
  return context;
}
