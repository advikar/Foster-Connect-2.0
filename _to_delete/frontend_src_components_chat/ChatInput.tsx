import { type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled, compact }: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={cn("border-t border-slate-200 bg-white", compact ? "p-3" : "p-4")}>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask me anything about resources, housing, jobs, education..."
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-300 transition-all",
            compact
              ? "px-3 py-2 text-[13px] min-h-[36px] max-h-[80px]"
              : "px-4 py-3 text-sm min-h-[44px] max-h-[120px]",
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size={compact ? "sm" : "default"}
          className={cn(
            "bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm",
            compact ? "size-9 rounded-lg" : "size-11 rounded-xl",
          )}
          aria-label="Send message"
        >
          <Send className={compact ? "size-3.5" : "size-4"} />
        </Button>
      </div>
    </div>
  );
}
