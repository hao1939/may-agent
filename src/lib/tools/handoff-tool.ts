import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { resolve, join } from "path";

// ── Types ──────────────────────────────────────────────────────────────

export interface HandoffToolOptions {
  /** The agent name to use as "From" in the handoff entry. */
  agentName: string;
  /** Root directory of agent definitions (for todo.md writes). */
  agentsRoot: string;
  /** Project root for resolving artifact paths. */
  projectRoot: string;
  /** Path to SIGNALS.md. Default: agents/shared/SIGNALS.md */
  signalsPath?: string;
  /** Callback to trigger target agent's heartbeat. */
  triggerHeartbeat?: (agentName: string) => boolean;
  /** Known agent names for validation. If provided, target must be in this list. */
  knownAgents?: string[];
}

// ── Schema ─────────────────────────────────────────────────────────────

const handoffSchema: TSchema = Type.Object({
  target: Type.String({
    description: "Agent to receive the handoff (e.g., 'qa', 'evaluator', 'bob')",
  }),
  artifact_path: Type.String({
    description: "Path to the file being handed off (must exist)",
  }),
  context: Type.String({
    description: "Brief context on why this is being handed off (1-2 sentences)",
  }),
  expectations: Type.String({
    description: "What is expected from the receiver (e.g., 'Run tests', 'Review and approve')",
  }),
  read_by: Type.Optional(Type.Array(Type.String(), {
    description: "List of agents who must read this artifact (e.g., ['may', 'tech-lead']). Auto-populated with [target] if omitted.",
  })),
});

interface HandoffToolParams {
  target: string;
  artifact_path: string;
  context: string;
  expectations: string;
  read_by?: string[];
}

// ── Tool factory ───────────────────────────────────────────────────────

/**
 * Create a `handoff` tool that enforces P82 (Explicit Acks) by construction.
 *
 * Instead of relying on agents to manually write compliant entries to SIGNALS.md
 * (which fails 100% of the time under cognitive load), this tool:
 *
 * 1. Validates the artifact exists
 * 2. Writes a structured, P82-compliant entry to SIGNALS.md
 * 3. Appends a todo item to the target agent's workspace/todo.md
 * 4. Triggers the target agent's heartbeat (if configured)
 *
 * The entry always includes `read_by: []` and `Status: PENDING_ACK`,
 * making P82 compliance automatic and failure-proof.
 *
 * Policy: P82 (Explicit Acks), P114 (Experience Replay), P131 (Text is Policy, Code is Law)
 */
export function createHandoffTool(options: HandoffToolOptions): AgentTool<TSchema> {
  const {
    agentName,
    agentsRoot,
    projectRoot,
    signalsPath: customSignalsPath,
    triggerHeartbeat,
    knownAgents,
  } = options;

  const signalsPath = customSignalsPath ?? join(projectRoot, "agents", "shared", "SIGNALS.md");

  return {
    name: "handoff",
    label: "Handoff",
    description:
      "Transfer ownership or request review of an artifact. " +
      "Writes a P82-compliant entry to SIGNALS.md with automatic read_by tracking, " +
      "notifies the target agent, and validates the artifact exists. " +
      "Use this instead of manually writing to SIGNALS.md.",
    parameters: handoffSchema,
    execute: async (_toolCallId: string, _params: unknown) => {
      const params = _params as HandoffToolParams;
      const { target, artifact_path, context, expectations, read_by } = params;

      // ── Validate target ────────────────────────────────────────
      if (!target || !target.trim()) {
        return {
          content: [{ type: "text" as const, text: "Handoff aborted: 'target' is required." }],
          details: undefined,
        };
      }

      if (knownAgents && knownAgents.length > 0 && !knownAgents.includes(target)) {
        return {
          content: [{
            type: "text" as const,
            text: `Handoff aborted: Unknown agent "${target}". Known agents: ${knownAgents.join(", ")}.`,
          }],
          details: undefined,
        };
      }

      // ── Validate artifact exists ───────────────────────────────
      if (!artifact_path || !artifact_path.trim()) {
        return {
          content: [{ type: "text" as const, text: "Handoff aborted: 'artifact_path' is required." }],
          details: undefined,
        };
      }

      const resolvedArtifact = resolve(projectRoot, artifact_path);
      if (!existsSync(resolvedArtifact)) {
        return {
          content: [{
            type: "text" as const,
            text: `Handoff aborted: artifact '${artifact_path}' does not exist.`,
          }],
          details: undefined,
        };
      }

      // ── Validate context and expectations ──────────────────────
      if (!context || !context.trim()) {
        return {
          content: [{ type: "text" as const, text: "Handoff aborted: 'context' is required." }],
          details: undefined,
        };
      }

      if (!expectations || !expectations.trim()) {
        return {
          content: [{ type: "text" as const, text: "Handoff aborted: 'expectations' is required." }],
          details: undefined,
        };
      }

      // ── Build the SIGNALS.md entry ─────────────────────────────
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace("T", " ");

      // P82: Auto-populate read_by with [target] if not explicitly provided
      const resolvedReadBy = (read_by && read_by.length > 0) ? read_by : [target];
      const readByStr = JSON.stringify(resolvedReadBy);

      const entry = [
        "",
        "---",
        "",
        `## Handoff: ${timestamp}`,
        `- **From**: ${agentName}`,
        `- **To**: ${target}`,
        `- **Artifact**: \`${artifact_path}\``,
        `- **Context**: ${context}`,
        `- **Expectations**: ${expectations}`,
        `- **Status**: PENDING_ACK`,
        `- **read_by**: ${readByStr}`,
      ].join("\n");

      // ── Write to SIGNALS.md ────────────────────────────────────
      try {
        const signalsDir = resolve(signalsPath, "..");
        mkdirSync(signalsDir, { recursive: true });

        if (!existsSync(signalsPath)) {
          // Create SIGNALS.md with header if it doesn't exist
          writeFileSync(signalsPath, `# Signals\n${entry}\n`, "utf-8");
        } else {
          // Read existing content and prepend after the first line (title)
          const existing = readFileSync(signalsPath, "utf-8");
          const lines = existing.split("\n");

          // Find the first "---" separator or end of first line to insert after
          let insertIdx = 1; // After title line
          // Skip any blank lines after title
          while (insertIdx < lines.length && lines[insertIdx].trim() === "") {
            insertIdx++;
          }

          // Insert the new entry after the title section
          const before = lines.slice(0, insertIdx).join("\n");
          const after = lines.slice(insertIdx).join("\n");
          const newContent = before + "\n" + entry + "\n\n" + after;
          writeFileSync(signalsPath, newContent, "utf-8");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: "text" as const,
            text: `Handoff failed: Could not write to SIGNALS.md: ${msg}`,
          }],
          details: undefined,
        };
      }

      // ── Write todo item for target agent ───────────────────────
      let todoWritten = false;
      try {
        const todoDir = join(agentsRoot, target, "workspace");
        mkdirSync(todoDir, { recursive: true });
        const todoPath = join(todoDir, "todo.md");
        const todoTimestamp = now.toISOString().slice(0, 16);
        const todoEntry = `- [ ] [from:${agentName} ${todoTimestamp}] You have a pending handoff. Artifact: ${artifact_path}. Check agents/shared/SIGNALS.md for details.\n`;

        if (!existsSync(todoPath)) {
          writeFileSync(todoPath, `# TODO\n\n${todoEntry}`, "utf-8");
        } else {
          appendFileSync(todoPath, todoEntry, "utf-8");
        }
        todoWritten = true;
      } catch {
        // Non-fatal: the SIGNALS.md entry is the critical part
        todoWritten = false;
      }

      // ── Trigger heartbeat ──────────────────────────────────────
      let heartbeatTriggered = false;
      if (triggerHeartbeat) {
        try {
          heartbeatTriggered = triggerHeartbeat(target);
        } catch {
          // Non-fatal
        }
      }

      // ── Return confirmation ────────────────────────────────────
      const parts = [
        `Handoff complete: ${artifact_path} → ${target}.`,
        `Entry written to SIGNALS.md with PENDING_ACK status.`,
      ];
      if (todoWritten) {
        parts.push(`Todo item added to ${target}'s workspace.`);
      }
      if (heartbeatTriggered) {
        parts.push(`${target}'s heartbeat triggered.`);
      }

      return {
        content: [{ type: "text" as const, text: parts.join(" ") }],
        details: undefined,
      };
    },
  };
}
