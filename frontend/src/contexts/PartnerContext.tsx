import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPartnerToken, getPartnerToken, partnerLogout, partnerMe, type PartnerIdentity } from "@/lib/api";

interface PartnerSession {
  partner: PartnerIdentity | null;
  checking: boolean;
  error: string;
  refresh: () => void;
  signedIn: (partner: PartnerIdentity) => void;
  signOut: () => Promise<void>;
}
const Context = createContext<PartnerSession | null>(null);
export function PartnerProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<PartnerIdentity | null>(null);
  const [checking, setChecking] = useState(Boolean(getPartnerToken()));
  const [error, setError] = useState("");
  const cache = useQueryClient();
  const clearCache = useCallback(() => cache.removeQueries({ predicate: query => String(query.queryKey[0]).startsWith("partner-") }), [cache]);
  const refresh = useCallback(() => {
    if (!getPartnerToken()) { setChecking(false); return; }
    setChecking(true); setError("");
    partnerMe().then(({ partner: identity }) => setPartner(identity)).catch(() => {
      setPartner(null);
      if (getPartnerToken()) setError("We couldn’t check your sign-in. Try again when the connection is back.");
    }).finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    refresh();
    const expired = () => { setPartner(null); clearPartnerToken(); clearCache(); };
    window.addEventListener("partner-session-expired", expired);
    return () => window.removeEventListener("partner-session-expired", expired);
  }, [refresh, clearCache]);
  return <Context.Provider value={{ partner, checking, error, refresh, signedIn: identity => { clearCache(); setError(""); setPartner(identity); }, signOut: async () => { await partnerLogout(); clearCache(); setPartner(null); setError(""); } }}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePartner() {
  const value = useContext(Context);
  if (!value) throw new Error("Partner provider is required");
  return value;
}
