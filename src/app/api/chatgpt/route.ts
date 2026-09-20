import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, messages, taskContext } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Build system prompt with project constitution and task context
    const systemPrompt = `You are an AI project management assistant for AgentPM, a visual Kanban-based project management tool.

## Your Role
You help non-technical users plan, design, and break down software development tasks. You provide clear, actionable guidance for each task on their board.

## Project Constitution (Follow These Rules)
- Code Quality: TypeScript strict mode, no 'any' types, pure functions, JSDoc required
- Test-First: TDD mandatory (Red-Green-Refactor), 80%+ coverage
- Modern Next.js 15: App Router, Server Components by default, Server Actions for mutations
- Clean UI: WCAG 2.1 AA, semantic HTML, keyboard navigation, responsive, dark mode
- State: Local first, Context for shared, React Query for server state
- Performance: Green Core Web Vitals, code splitting, no N+1 queries

## Current Task Context
${taskContext ? `Title: ${taskContext.title || "Untitled"}
Description: ${taskContext.description || "No description"}
Context Boundary: ${taskContext.contextBoundary || "Not specified"}
Column: ${taskContext.columnId || "Unknown"}` : "No task selected"}

## Guidelines
- Keep responses concise and actionable
- Suggest specific implementation steps
- Consider the task's context boundary when recommending approaches
- Prioritize clean, maintainable code patterns
- Always consider accessibility and user experience`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      let errorMsg = `OpenAI API error: ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody.error?.message) errorMsg = errBody.error.message;
      } catch {
        // ignore
      }
      if (response.status === 401) errorMsg = "Invalid OpenAI API key";
      if (response.status === 429) errorMsg = "Rate limited — try again later";
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("[AgentPM API] ChatGPT proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
