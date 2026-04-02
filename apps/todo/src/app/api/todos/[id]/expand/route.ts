import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const openai = createOpenAI({
  baseURL: process.env.OPENCLAW_BASE_URL ?? "http://localhost:3456/v1",
  apiKey: "not-needed",
});

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const todoResult = await db.execute({
    sql: "SELECT * FROM todos WHERE id = ?",
    args: [id],
  });

  if (todoResult.rows.length === 0) {
    return NextResponse.json({ error: "todo not found" }, { status: 404 });
  }

  const todo = todoResult.rows[0];

  const factsResult = await db.execute(
    "SELECT key, value FROM user_facts ORDER BY created_at ASC"
  );
  const patternsResult = await db.execute(
    "SELECT observation FROM patterns ORDER BY created_at DESC LIMIT 10"
  );

  const factsText = factsResult.rows
    .map((r) => `${r.key}: ${r.value}`)
    .join("\n");

  const patternsText = patternsResult.rows
    .map((r) => `- ${r.observation}`)
    .join("\n");

  const systemPrompt = `You are a smart personal assistant that knows this user well.

User facts:
${factsText || "(none yet)"}

Observed patterns:
${patternsText || "(none yet)"}

Return ONLY valid JSON in this exact shape, no markdown, no explanation:
{"subtasks":["string","string","string"],"question":"string"}`;

  const userPrompt = `Todo: "${todo.text}"

Provide 3-5 concrete subtasks to complete this todo, and one clarifying question that would make it more actionable.`;

  const { text } = await generateText({
    model: openai("claude-sonnet-4"),
    system: systemPrompt,
    prompt: userPrompt,
  });

  let parsed: { subtasks: string[]; question: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("AI returned invalid JSON:", text);
    return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 });
  }

  await db.execute({
    sql: "UPDATE todos SET expanded_at = ? WHERE id = ?",
    args: [Date.now(), id],
  });

  return NextResponse.json(parsed);
}
