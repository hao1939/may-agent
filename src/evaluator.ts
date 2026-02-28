import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SubagentManager } from "./manager.js";
import { readSessionMessages, historyDir } from "./persistence.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface EvaluationScores {
  efficiency: number;
  quality: number;
  pattern_detected: boolean;
  pattern_name: string | null;
  total_tool_calls: number;
  productive_calls: number;
  wasted_calls: number;
  verdict: "good" | "acceptable" | "needs_improvement";
}

export interface EvaluationResult {
  scores: EvaluationScores;
  lessons: string | null;
  workflowCode: string | null;
  workflowName: string | null;
  raw: string;
}

// ── Transcript formatting ──────────────────────────────────────────────

function formatTranscript(messages: AgentMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (!("role" in msg)) continue; // skip custom messages
    lines.push(`## ${msg.role}`);

    if (msg.role === "toolResult") {
      const text = msg.content
        ?.map((c) => c.type === "text" ? c.text : "")
        .join("")
        .slice(0, 500) ?? "";
      lines.push(`[tool_result: ${msg.toolName}] ${text}`);
    } else if (typeof msg.content === "string") {
      lines.push(msg.content);
    } else {
      for (const block of msg.content) {
        if (typeof block === "string") {
          lines.push(block);
        } else if (block.type === "text") {
          lines.push(block.text);
        } else if (block.type === "toolCall") {
          const args = JSON.stringify(block.arguments).slice(0, 500);
          lines.push(`[tool_call: ${block.name}] ${args}`);
        } else if (block.type === "thinking") {
          lines.push(`[thinking] ${block.thinking.slice(0, 200)}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Response parsing ───────────────────────────────────────────────────

function parseEvaluation(text: string): EvaluationResult {
  const result: EvaluationResult = {
    scores: {
      efficiency: 0,
      quality: 0,
      pattern_detected: false,
      pattern_name: null,
      total_tool_calls: 0,
      productive_calls: 0,
      wasted_calls: 0,
      verdict: "needs_improvement",
    },
    lessons: null,
    workflowCode: null,
    workflowName: null,
    raw: text,
  };

  // Extract JSON scores block
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      result.scores = { ...result.scores, ...parsed };
    } catch {
      // Keep defaults
    }
  }

  // Extract lessons section
  const lessonsMatch = text.match(/### Lessons\s*\n([\s\S]*?)(?=\n### |$)/);
  if (lessonsMatch) {
    const lessons = lessonsMatch[1].trim();
    if (lessons) result.lessons = lessons;
  }

  // Extract workflow code
  const workflowMatch = text.match(/### Workflow Suggestion\s*\n[\s\S]*?```typescript\s*\n([\s\S]*?)\n\s*```/);
  if (workflowMatch) {
    result.workflowCode = workflowMatch[1];
    // Try to extract workflow name from the code
    const nameMatch = result.workflowCode.match(/export const name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) result.workflowName = nameMatch[1];
  }

  return result;
}

// ── Main function ──────────────────────────────────────────────────────

export interface EvaluateSessionOptions {
  manager: SubagentManager;
  sessionId: string;
  agentName: string;
  workflowUsed: string | null;
  persistDir: string;
  /** Path to the agent's knowledge directory (for appending lessons). */
  knowledgeDir: string;
  /** Path to the agent's workflows directory (for writing suggested workflows). */
  workflowDir?: string;
}

/**
 * Evaluate a completed session using the evaluator agent.
 *
 * 1. Loads the session transcript from JSONL
 * 2. Sends it to the evaluator agent
 * 3. Parses scores, lessons, and workflow suggestions
 * 4. Appends lessons to the agent's knowledge/lessons.md
 * 5. Writes suggested workflow files
 * 6. Saves scores to .state/evaluations/
 */
export async function evaluateSession(opts: EvaluateSessionOptions): Promise<EvaluationResult> {
  const { manager, sessionId, agentName, workflowUsed, persistDir, knowledgeDir, workflowDir } = opts;

  // 1. Load session transcript (check history dir first, then active)
  let messages: AgentMessage[] = [];
  const historyJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
  if (existsSync(historyJsonl)) {
    const raw = readFileSync(historyJsonl, "utf-8");
    if (raw.trim()) {
      messages = raw.trim().split("\n").map((line) => JSON.parse(line) as AgentMessage);
    }
  }
  if (messages.length === 0) {
    messages = readSessionMessages(persistDir, sessionId);
  }

  if (messages.length === 0) {
    return {
      scores: {
        efficiency: 0, quality: 0, pattern_detected: false, pattern_name: null,
        total_tool_calls: 0, productive_calls: 0, wasted_calls: 0, verdict: "needs_improvement",
      },
      lessons: null,
      workflowCode: null,
      workflowName: null,
      raw: "(no session transcript found)",
    };
  }

  const transcript = formatTranscript(messages);

  // 2. Build evaluation prompt
  const prompt = [
    `# Session Evaluation\n`,
    `## Agent: ${agentName}`,
    `## Workflow Used: ${workflowUsed ?? "slow path (no workflow)"}`,
    `## Session ID: ${sessionId}\n`,
    `## Transcript\n${transcript}\n`,
    `## Instructions\nEvaluate this session according to your criteria. Output scores, lessons, and workflow suggestion if applicable.`,
  ].join("\n");

  // 3. Run evaluator agent
  const evalSessionId = manager.run("evaluator", prompt);
  const evalResult = await manager.waitFor(evalSessionId);

  const responseText = evalResult?.lastAssistantText ?? "";

  // 4. Parse structured output
  const evaluation = parseEvaluation(responseText);

  // 5. Append lessons to agent's knowledge/lessons.md
  if (evaluation.lessons) {
    const lessonsPath = join(knowledgeDir, "lessons.md");
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const header = `\n## Session ${sessionId} (${timestamp})\n`;
    const workflowNote = workflowUsed ? `Workflow: ${workflowUsed}\n` : "";

    if (!existsSync(lessonsPath)) {
      mkdirSync(dirname(lessonsPath), { recursive: true });
      writeFileSync(lessonsPath, `# Lessons\n\nFeedback from evaluator sessions.\n${header}${workflowNote}\n${evaluation.lessons}\n`, "utf-8");
    } else {
      appendFileSync(lessonsPath, `${header}${workflowNote}\n${evaluation.lessons}\n`, "utf-8");
    }
  }

  // 6. Write workflow if pattern detected
  if (evaluation.workflowCode && evaluation.workflowName && workflowDir) {
    const fileName = evaluation.workflowName.replace(/\s+/g, "-").toLowerCase() + ".ts";
    const workflowPath = join(workflowDir, fileName);
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(workflowPath, evaluation.workflowCode, "utf-8");
  }

  // 7. Save scores
  const evalDir = join(persistDir, "evaluations");
  mkdirSync(evalDir, { recursive: true });
  const scoresPath = join(evalDir, `${sessionId}.json`);
  writeFileSync(scoresPath, JSON.stringify(evaluation.scores, null, 2), "utf-8");

  return evaluation;
}
