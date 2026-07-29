// src\app\dashboard\ai-assistant\page.tsx
// src\app\dashboard\ai-assistant\page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ChatBubble from "@/components/dashboard/ai-assistant/ChatBubble";
import TypingIndicator from "@/components/dashboard/ai-assistant/TypingIndicator";
import { AIService, ChatMessage } from "@/services/ai.service";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your DataVerse AI assistant. Ask me anything about your data — I can help explain statistics, suggest analyses, or answer general questions.",
};

const SUGGESTED_PROMPTS = [
  "What's the difference between mean and median?",
  "How do I detect outliers in my dataset?",
  "Explain correlation vs causation",
  "What statistical test should I use for my data?",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the textarea as the user types, capped at ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function handleSend(promptOverride?: string) {
    const trimmed = (promptOverride ?? input).trim();
    if (!trimmed || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];

    setMessages(newMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await AIService.sendMessage(newMessages);

      if (res.error) {
        setError(res.error);
      } else {
        setMessages([
          ...newMessages,
          { role: "assistant", content: res.reply || "" },
        ]);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClearChat() {
    setMessages([WELCOME_MESSAGE]);
    setError("");
  }

  const showSuggestions = messages.length === 1;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex h-[calc(100vh-6rem)] flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
                AI Assistant
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Chat with your AI data analyst.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearChat}
              disabled={messages.length === 1}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Trash2 size={14} />
              Clear chat
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#111827]">
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}

              {showSuggestions && !loading && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-left text-sm text-gray-600 transition hover:border-[#2563EB]/30 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {loading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {error && (
              <p className="border-t border-gray-200 bg-red-50 px-4 py-2 text-sm text-red-500 dark:border-gray-800 dark:bg-red-900/20">
                {error}
              </p>
            )}

            <div className="border-t border-gray-200 p-3 dark:border-gray-800">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your data... (Shift+Enter for new line)"
                  rows={1}
                  className="max-h-40 flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white transition hover:bg-[#2563EB]/90 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}