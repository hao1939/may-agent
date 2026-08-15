import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * hallucinated-path guard — C7.1 Hallucinated Path detection.
 *
 * Scans step_done events for bash() tool calls containing /home/ paths,
 * which don't exist in the container environment (project root is /app).
 * Emits a warn demand on detection.
 *
 * Targets C7.1 violations (~9% of the 190-violation baseline).
 */

const HALLUCINATED_PATTERNS = [
  /\/home\/\w+/,
  /\/Users\/\w+/,
  /\/root\//,
];

/** Commands that legitimately reference /home/ (e.g., grep searching for it). */
const ALLOWLIST = [
  /grep\s+.*\/home\//,
  /echo\s+["'].*\/home\//,
  /sed\s+.*\/home\//,
];

function extractBashCommands(messages: any[]): string[] {
  const cmds: string[] = [];
  for (const msg of messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if ((part.type === "toolCall" || part.type === "tool_use") &&
          (part.name === "bash" || part.toolName === "bash")) {
        const args = part.arguments ?? part.input ?? {};
        if (typeof args.command === "string") cmds.push(args.command);
      }
    }
  }
  return cmds;
}

export const guard: WorkflowGuard = {
  name: "hallucinated-path",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];

    const cmds = extractBashCommands(event.result.messages);
    const violations: string[] = [];

    for (const cmd of cmds) {
      // Skip allowlisted commands
      if (ALLOWLIST.some(re => re.test(cmd))) continue;

      for (const pattern of HALLUCINATED_PATTERNS) {
        if (pattern.test(cmd)) {
          const match = cmd.match(pattern);
          if (match) violations.push(match[0]);
        }
      }
    }

    if (violations.length === 0) return [];

    const unique = [...new Set(violations)];
    return [
      {
        type: "warn",
        reason: `C7.1 Hallucinated Path: bash command(s) referenced non-existent path(s): ${unique.join(", ")}. ` +
          `The tool guard blocks the bad command; use relative paths or /app/... instead.`,
      },
    ];
  },
};
