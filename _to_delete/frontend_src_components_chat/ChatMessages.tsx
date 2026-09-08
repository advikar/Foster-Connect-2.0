import { forwardRef } from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "./types";
import { cn } from "@/lib/utils";

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderContent(content: string) {
  // Split by lines and handle basic markdown-like bold and line breaks
  return content.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;

    // Convert **bold** to <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    // Handle list items
    if (line.trim().startsWith("- ")) {
      return (
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-emerald-400 mt-1 shrink-0">&#8226;</span>
          <span>{parts.map(p => (typeof p === "string" ? p.replace(/^- /, "") : p))}</span>
        </div>
      );
    }

    // Handle numbered list items
    if (/^\d+\.\s/.test(line.trim())) {
      return (
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-emerald-500 font-semibold shrink-0">{line.trim().match(/^\d+/)?.[0]}.</span>
          <span>{parts.map(p => (typeof p === "string" ? p.replace(/^\d+\.\s/, "") : p))}</span>
        </div>
      );
    }

    return (
      <p key={i} className="my-0.5">
        {parts}
      </p>
    );
  });
}

interface TypingIndicatorProps {
  compact?: boolean;
}

function TypingIndicator({ compact }: TypingIndicatorProps) {
  return (
    <div className="flex items-end gap-2.5">
      <div
        className={cn(
          "rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0",
          compact ? "size-6" : "size-8",
        )}
      >
        <Sparkles className={compact ? "size-3" : "size-4"} />
      </div>
      <div
        className={cn(
          "bg-emerald-50/80 border border-emerald-100 rounded-2xl rounded-bl-none flex items-center gap-1",
          compact ? "px-3 py-2" : "px-4 py-3",
        )}
      >
        <span className="size-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
        <span className="size-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
        <span className="size-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isTyping: boolean;
  compact?: boolean;
}

export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(function ChatMessages(
  { messages, isTyping, compact },
  ref,
) {
  return (
    <div ref={ref} className={cn("flex-1 overflow-y-auto", compact ? "p-3 space-y-3" : "p-6 space-y-4")}>
      {messages.map(msg => (
        <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
          {msg.role === "bot" && (
            <div className="flex items-end gap-2.5 max-w-[85%]">
              <div
                className={cn(
                  "rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0",
                  compact ? "size-6" : "size-8",
                )}
              >
                <Sparkles className={compact ? "size-3" : "size-4"} />
              </div>
              <div>
                <div
                  className={cn(
                    "bg-emerald-50/80 border border-emerald-100 rounded-2xl rounded-bl-none text-slate-700 leading-relaxed",
                    compact ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm",
                  )}
                >
                  {renderContent(msg.content)}
                </div>
                <p className={cn("text-slate-400 mt-1", compact ? "text-[10px] ml-1" : "text-xs ml-1")}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          )}
          {msg.role === "user" && (
            <div className="max-w-[80%]">
              <div
                className={cn(
                  "bg-white border border-slate-200 rounded-2xl rounded-br-none text-slate-800 leading-relaxed shadow-sm",
                  compact ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm",
                )}
              >
                <p>{msg.content}</p>
              </div>
              <p className={cn("text-slate-400 mt-1 text-right", compact ? "text-[10px] mr-1" : "text-xs mr-1")}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          )}
        </div>
      ))}
      {isTyping && <TypingIndicator compact={compact} />}
    </div>
  );
});
