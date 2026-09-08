import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage } from "./types";
import { sendMessageToAgent } from "./agentService";
import type { RoadmapTask } from "@/lib/api";

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "bot",
  content:
    "Hi there! I'm your Foster Connect AI Navigator. I can help you find resources, talk through what's on your mind, or build you a personalized roadmap on the Roadmap page. What can I help you with today?",
  timestamp: new Date(),
};

export function useChat(onTasksGenerated?: (tasks: RoadmapTask[]) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    // Small delay so DOM updates before scroll
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      // Give the AI the conversation so far so it doesn't lose the thread.
      const history = messagesRef.current.map(m => ({ role: m.role, content: m.content }));

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInputValue("");
      setIsTyping(true);

      try {
        const response = await sendMessageToAgent(trimmed, history);
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: response.reply,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);

        if (response.tasks && response.tasks.length > 0 && onTasksGenerated) {
          // These are already fully-formed, backend-persisted tasks with
          // real ids, so they can be used as-is.
          onTasksGenerated(response.tasks);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "bot",
          content:
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or reach out to your case worker directly for immediate help.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, onTasksGenerated],
  );

  return {
    messages,
    isTyping,
    inputValue,
    setInputValue,
    sendMessage,
    scrollRef,
  };
}
