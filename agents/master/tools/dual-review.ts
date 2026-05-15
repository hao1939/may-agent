/**
 * dual_review tool — Ping-pong review between Codex and Claude Code.
 *
 * One agent implements, the other reviews. Loop until the reviewer says
 * APPROVED or max rounds reached. Both use persistent sessions so context
 * accumulates across rounds and across invocations.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TIMEOUT_DEFAULT = 300;
const MAX_ROUNDS_DEFAULT = 3;

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

function extractText(result: any): string {
  if (!result?.content) return String(result);
  for (const block of result.content) {
    if (block.type === "text") return block.text;
  }
  return String(result);
}

const ERROR_PATTERNS = [
  "no rollout found",
  "[error]",
  "[exit 1]",
  "ENOENT",
  "spawn .* EACCES",
  "session not found",
  "Could not resume",
];

function isErrorOutput(text: string): boolean {
  const lower = text.toLowerCase();
  return ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase())) ||
    (text.startsWith("[exit ") && !text.startsWith("[exit 0]"));
}

/** Call a worker tool, retry with new_session if the stored session is stale. */
async function callWithRetry(
  tool: any,
  params: any,
  toolName: string,
  log: string[],
): Promise<string> {
  const result = await tool.execute("", params);
  const text = extractText(result);
  if (!isErrorOutput(text)) return text;

  // Stale session — retry fresh
  log.push(`⚠️ ${toolName} errored (${text.slice(0, 100)}…), retrying with fresh session.\n`);
  const retryResult = await tool.execute("", { ...params, new_session: true });
  return extractText(retryResult);
}

export default function factory(opts: { projectRoot: string; agentRoot: string; persistDir: string }) {
  // Defer loading sibling tools until first execute to avoid import issues
  let codex: any;
  let cc: any;

  async function ensureTools() {
    if (codex && cc) return;
    const toolsDir = resolve(opts.agentRoot, "tools");
    const codexMod = await import(`${resolve(toolsDir, "codex-worker.ts")}?t=${Date.now()}`);
    const ccMod = await import(`${resolve(toolsDir, "cc-worker.ts")}?t=${Date.now()}`);
    codex = codexMod.default(opts);
    cc = ccMod.default(opts);
  }

  return {
    name: "dual_review",
    label: "Dual Review",
    description:
      "Collaborative ping-pong between Codex and Claude Code. " +
      "One implements, the other builds on it with ideas and improvements. Loop until both converge. " +
      "Both maintain persistent sessions. Use for tasks that benefit from two perspectives.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task to implement and review." },
        max_rounds: { type: "number", description: "Max review rounds. Default: 3." },
        timeout: { type: "number", description: "Per-agent-call timeout in seconds. Default: 300." },
        first: { type: "string", description: "Who implements first: 'codex' (default) or 'cc'." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      await ensureTools();
      const { prompt, max_rounds, timeout, first } = params;
      const maxRounds = max_rounds ?? MAX_ROUNDS_DEFAULT;
      const timeoutSec = timeout ?? TIMEOUT_DEFAULT;
      const implementerFirst = first !== "cc";

      const implementer = implementerFirst ? codex : cc;
      const reviewer = implementerFirst ? cc : codex;
      const implName = implementerFirst ? "Codex" : "Claude Code";
      const revName = implementerFirst ? "Claude Code" : "Codex";

      const log: string[] = [];
      log.push(`## Collaborative Session: ${implName} implements, ${revName} builds on it\n`);

      // Round 1: implementer gets the task
      log.push(`### ${implName} — Implementation\n`);
      let implOutput = await callWithRetry(implementer, { prompt, timeout: timeoutSec }, implName, log);
      log.push(implOutput.slice(0, 2000) + "\n");

      for (let round = 1; round <= maxRounds; round++) {
        // Collaborator builds on the work
        const reviewPrompt =
          `You're collaborating with ${implName} on this task. Round ${round}/${maxRounds}.\n\n` +
          `## Their work so far:\n\n${implOutput}\n\n` +
          `## Your role — be a creative collaborator:\n` +
          `1. Build on their work: what would you add, what approach would be even better?\n` +
          `2. Contribute your own ideas, code, or analysis\n` +
          `3. Identify edge cases worth addressing\n` +
          `4. End with a forward-looking suggestion: "Given this, the natural next step would be…"\n\n` +
          `Begin your response with one of:\n` +
          `- **CONVERGED** — the work is solid and you've added everything you can\n` +
          `- **BUILDING** — here's how to push this further (then describe)`;

        log.push(`### ${revName} — Collaboration (round ${round})\n`);
        const reviewOutput = await callWithRetry(reviewer, { prompt: reviewPrompt, timeout: timeoutSec }, revName, log);
        log.push(reviewOutput.slice(0, 2000) + "\n");

        // Check for convergence
        const firstLine = reviewOutput.trim().split("\n")[0] || "";
        if (firstLine.includes("CONVERGED") && !firstLine.includes("BUILDING")) {
          log.push(`\n✅ **Converged in round ${round}.** Both agents aligned.\n`);
          return textResult(log.join("\n"));
        }

        if (round === maxRounds) {
          log.push(`\n⚠️ **Max rounds (${maxRounds}) reached.** Last round still had ideas to explore.\n`);
          return textResult(log.join("\n"));
        }

        // Implementer incorporates ideas
        const revisePrompt =
          `Your collaborator has ideas to push this further (round ${round}/${maxRounds}):\n\n` +
          `${reviewOutput}\n\n` +
          `Incorporate what improves the work. Answer their forward-looking suggestion — take that next step.`;

        log.push(`### ${implName} — Revision (round ${round})\n`);
        implOutput = await callWithRetry(implementer, { prompt: revisePrompt, timeout: timeoutSec }, implName, log);
        log.push(implOutput.slice(0, 2000) + "\n");
      }

      return textResult(log.join("\n"));
    },
  };
}
