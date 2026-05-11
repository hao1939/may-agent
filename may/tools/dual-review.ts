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
      "Ping-pong review between Codex and Claude Code until agreement. " +
      "Codex implements (by default), Claude Code reviews. Loop until APPROVED or max rounds. " +
      "Both maintain persistent sessions. Use for critical changes needing cross-verification.",
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
      log.push(`## Dual Review: ${implName} implements, ${revName} reviews\n`);

      // Round 1: implementer gets the task
      log.push(`### ${implName} — Implementation\n`);
      const implResult = await implementer.execute("", { prompt, timeout: timeoutSec });
      let implOutput = extractText(implResult);
      log.push(implOutput.slice(0, 2000) + "\n");

      for (let round = 1; round <= maxRounds; round++) {
        // Reviewer reviews
        const reviewPrompt =
          `You are reviewing work by ${implName}. This is round ${round}/${maxRounds}.\n\n` +
          `## Their output:\n\n${implOutput}\n\n` +
          `## Instructions:\n` +
          `Review thoroughly. Begin your response with exactly one of:\n` +
          `- **APPROVED** — if the work is correct, complete, and ready to ship\n` +
          `- **CHANGES_REQUESTED** — if there are issues to fix\n\n` +
          `Then explain your reasoning. If requesting changes, be specific about what to fix.`;

        log.push(`### ${revName} — Review (round ${round})\n`);
        const reviewResult = await reviewer.execute("", { prompt: reviewPrompt, timeout: timeoutSec });
        const reviewOutput = extractText(reviewResult);
        log.push(reviewOutput.slice(0, 2000) + "\n");

        // Check for approval
        const firstLine = reviewOutput.trim().split("\n")[0] || "";
        if (firstLine.includes("APPROVED") && !firstLine.includes("CHANGES_REQUESTED")) {
          log.push(`\n✅ **Agreement reached in round ${round}.** ${revName} approved.\n`);
          return textResult(log.join("\n"));
        }

        if (round === maxRounds) {
          log.push(`\n⚠️ **Max rounds (${maxRounds}) reached without agreement.** Last review had outstanding concerns.\n`);
          return textResult(log.join("\n"));
        }

        // Implementer revises
        const revisePrompt =
          `${revName} reviewed your work and requested changes (round ${round}/${maxRounds}):\n\n` +
          `${reviewOutput}\n\n` +
          `Address their concerns. Make the changes they requested.`;

        log.push(`### ${implName} — Revision (round ${round})\n`);
        const reviseResult = await implementer.execute("", { prompt: revisePrompt, timeout: timeoutSec });
        implOutput = extractText(reviseResult);
        log.push(implOutput.slice(0, 2000) + "\n");
      }

      return textResult(log.join("\n"));
    },
  };
}
