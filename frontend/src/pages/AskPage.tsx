import { MayaConversation } from "@/components/chat/MayaConversation";

/**
 * Ask — Maya as a page, not a bubble.
 *
 * Desktop: a quiet left column explains what Maya is and isn't, the
 * conversation takes the middle. Phone: the conversation is the page.
 */
export function AskPage() {
  return (
    <div className="container-wide lg:grid lg:grid-cols-[320px_minmax(0,760px)] lg:gap-14 lg:pt-12">
      <aside className="hidden lg:block">
        <h1 className="font-display text-[26px] font-bold text-ink">Ask Maya</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Maya is an AI guide. She only answers from listings a person has checked, and shows you which. She is not a caseworker and can&rsquo;t decide what you qualify for.
        </p>
        <div className="mt-6 border-t border-rule pt-5 text-[14px] leading-relaxed text-ink-faint">
          <p>Nothing here is tied to your name.</p>
          <p className="mt-1">The conversation clears when you close the tab.</p>
        </div>
      </aside>

      <section aria-label="Conversation with Maya" className="flex flex-col lg:min-h-[calc(100vh-64px-48px)] lg:border-x lg:border-rule">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 lg:hidden">
          <div>
            <h1 className="font-display text-[18px] font-bold text-ink">Maya</h1>
            <p className="text-[12px] text-ink-faint">AI guide &middot; checked listings only &middot; not a caseworker</p>
          </div>
        </div>
        <MayaConversation className="flex-1" />
      </section>
    </div>
  );
}
