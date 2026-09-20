"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { useChatGPT } from "@/hooks/useChatGPT";

export interface Task {
  id: string;
  title: string;
  description: string;
  contextBoundary: string;
  agentPrompt: string;
  columnId: string;
  createdAt: number;
}

export interface ColumnDef {
  id: string;
  title: string;
  icon: string;
}

export interface TaskDetailDrawerProps {
  task: Task | null;
  columns: ColumnDef[];
  onClose: () => void;
  isOpen: boolean;
}

type DrawerTab = "details" | "chat";

/**
 * Side panel (drawer) that slides in from the right showing task details
 * and an integrated ChatGPT planner.
 */
export function TaskDetailDrawer({ task, columns, onClose, isOpen }: TaskDetailDrawerProps) {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DrawerTab>("details");
  const [chatInput, setChatInput] = React.useState("");

  const taskContext = React.useMemo(() => {
    if (!task) return null;
    return {
      title: task.title,
      description: task.description,
      contextBoundary: task.contextBoundary,
      columnId: task.columnId,
    };
  }, [task]);

  const { messages, isLoading, error, hasMounted, isConfigured, sendMessage } = useChatGPT(taskContext);

  // Close on Escape key
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Reset tab when task changes
  React.useEffect(() => {
    if (task) setActiveTab("details");
  }, [task?.id]);

  if (!task || !isOpen) return null;

  const column = columns.find((c) => c.id === task.columnId);

  const handleCopy = async () => {
    if (!task.agentPrompt) return;
    try {
      await navigator.clipboard.writeText(task.agentPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    await sendMessage(chatInput);
    setChatInput("");
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Task Details
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              {task.contextBoundary}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "details"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            📋 Details
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "chat"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            🤖 Chat
            {isConfigured && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"></span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" ? (
            /* Details Tab */
            <div className="p-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {task.title}
              </h3>

              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {task.description || "No description"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono">
                  {task.contextBoundary}
                </Badge>
                <Badge variant="secondary">
                  {column?.icon} {column?.title}
                </Badge>
              </div>

              {/* Agent Prompt Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    🤖 Coding Agent Instructions
                  </h4>
                  {task.agentPrompt && (
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        copied
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {copied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          📋 Copy Prompt for Agent
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                  {task.agentPrompt ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {task.agentPrompt}
                    </pre>
                  ) : (
                    <p className="text-xs italic text-zinc-400">
                      No agent instructions set for this task.
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400">
                  Created: {new Date(task.createdAt).toLocaleString()}
                </p>
                <p className="text-[10px] text-zinc-400">
                  Task ID: {task.id}
                </p>
              </div>
            </div>
          ) : (
            /* Chat Tab */
            <div className="flex h-full flex-col">
              {!hasMounted ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-800">
                    ⏳
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Loading...
                  </h4>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Checking for OpenAI API key configuration...
                  </p>
                </div>
              ) : isConfigured ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    {messages.length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl dark:bg-blue-900/30">
                          🤖
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Chat with ChatGPT
                        </h4>
                        <p className="mt-2 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                          Ask about this task, get implementation guidance, or brainstorm ideas. 
                          The AI knows your project context and task details.
                        </p>
                        <button
                          onClick={() => setChatInput("How should I implement this task?")}
                          className="mt-4 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          💡 "How should I implement this task?"
                        </button>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                            msg.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-lg bg-zinc-100 px-4 py-2.5 dark:bg-zinc-800">
                          <div className="flex gap-1">
                            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }}></span>
                            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }}></span>
                            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="rounded-md bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ask about this task..."
                        rows={1}
                        className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isLoading}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* No API Key */
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-800">
                    ⚙️
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    ChatGPT Not Configured
                  </h4>
                  <p className="mt-2 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                    Please add your OpenAI API key in settings to unlock the built-in ChatGPT planner.
                  </p>
                  <button
                    onClick={() => setActiveTab("details")}
                    className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    ← Back to Details
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
