"use client";

import * as React from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface TaskContext {
  title: string;
  description: string;
  contextBoundary: string;
  columnId: string;
}

const OPENAI_KEY_KEY = "agentpm-openai-key";

/**
 * Custom hook for managing ChatGPT conversations.
 * Uses hasMounted pattern to eliminate hydration mismatch.
 */
export function useChatGPT(taskContext: TaskContext | null) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [hasMounted, setHasMounted] = React.useState(false);

  // Mount effect — set flag and read localStorage
  React.useEffect(() => {
    setHasMounted(true);
    const key = localStorage.getItem(OPENAI_KEY_KEY);
    if (key) setApiKey(key);
  }, []);

  // Listen for storage events (cross-tab) and custom event (same-tab)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const key = localStorage.getItem(OPENAI_KEY_KEY);
      setApiKey(key || null);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("agentpm-openai-key-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("agentpm-openai-key-changed", handleStorageChange);
    };
  }, []);

  const sendMessage = React.useCallback(async (input: string) => {
    if (!input.trim() || !apiKey) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          taskContext,
        }),
      });

      if (!response.ok) {
        let errorMsg = `API error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.error) errorMsg = errBody.error;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "No response",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("[AgentPM] ChatGPT error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }, [messages, apiKey, taskContext]);

  const setApiKeyAndBroadcast = React.useCallback((key: string) => {
    localStorage.setItem(OPENAI_KEY_KEY, key);
    setApiKey(key);
    window.dispatchEvent(new Event("agentpm-openai-key-changed"));
  }, []);

  const clearApiKey = React.useCallback(() => {
    localStorage.removeItem(OPENAI_KEY_KEY);
    setApiKey(null);
    window.dispatchEvent(new Event("agentpm-openai-key-changed"));
  }, []);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    apiKey,
    hasMounted,
    setApiKey: setApiKeyAndBroadcast,
    clearApiKey,
    sendMessage,
    clearMessages,
    isConfigured: !!apiKey,
  };
}
