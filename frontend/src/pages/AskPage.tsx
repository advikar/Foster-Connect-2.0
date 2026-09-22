import { useEffect } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams } from "react-router-dom";
import { NovaConversation } from "@/components/chat/NovaConversation";
import { useNova } from "@/contexts/NovaContext";

/**
 * Ask — Nova as a page, not a bubble.
 *
 * Desktop: a quiet left column explains what Nova is and isn't, the
 * conversation takes the middle. Phone: the conversation is the page.
 */
export function AskPage() {
  usePageMeta("Ask Nova", "Ask an AI guide that answers only from checked listings. No account needed.", "/ask");
  // Find's empty state links here with ?q=…; send it as the first message once.
  const [params, setParams] = useSearchParams();
  const { openNova } = useNova();
  useEffect(() => {
    const q = params.get("q");
    if (q) { setParams({}, { replace: true }); openNova(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="container-wide lg:grid lg:grid-cols-[320px_minmax(0,760px)] lg:gap-14 lg:pt-12">
      <aside className="hidden lg:block">
        <h1 className="font-display text-[26px] font-bold text-ink">Ask Nova</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Nova is an AI guide. It only answers from listings a person has checked, and shows you which. Nova is not a caseworker or a lawyer and can&rsquo;t decide what you qualify for — confirm details with the program itself.
        </p>
        <div className="mt-6 border-t border-rule pt-5 text-[14px] leading-relaxed text-ink-faint">
          <p>No account, no name needed. What you type is sent through our server to an AI provider to write the reply, so leave out names and addresses.</p>
          <p className="mt-1">Conversations are saved in this browser. Nova remembers what you said here, and in your past chats, until you clear them. <Link to="/privacy" className="text-brand underline">How your information is handled</Link></p>
        </div>
      </aside>

      <section aria-label="Conversation with Nova" className="flex flex-col lg:min-h-[calc(100vh-64px-48px)] lg:border-x lg:border-rule">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 lg:hidden">
          <div>
            <h1 className="font-display text-[18px] font-bold text-ink">Nova</h1>
            <p className="text-[12px] text-ink-faint">AI guide &middot; answers from checked listings &middot; messages go to an AI provider &middot; <Link to="/privacy" className="underline">details</Link></p>
          </div>
        </div>
        <NovaConversation className="flex-1" />
      </section>
    </div>
  );
}
