/**
 * Agent Growth Tools — Tool wrappers for the growth cycle.
 *
 * Wraps the pure logic from growth.ts in AgentTool format.
 * Handles manager registration/unregistration as side effects.
 */

import { Type } from "@mariozechner/pi-ai";
import { type AgentTool } from "@mariozechner/pi-agent-core";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { SubagentManager } from "../manager.js";
import { forkAgent, promoteAgent, discardAgent, type GrowthConfig } from "../growth.js";

export interface AgentGrowthToolOptions {
  agentsRoot: string;
  manager: SubagentManager;
  /** Register a newly forked agent with the manager. */
  loadAgent: (agentDir: string) => void | Promise<void>;
  /** Re-register a live agent after promotion. */
  reloadAgent: (name: string) => void | Promise<void>;
  /** Optional persist directory for memory copy/cleanup. */
  persistDir?: string;
}

/**
 * Creates the agent growth toolset: fork, verify, promote, discard.
 */
export function createAgentGrowthTools(opts: AgentGrowthToolOptions): AgentTool[] {
  const { agentsRoot, manager, loadAgent, reloadAgent, persistDir } = opts;

  const growthConfig: GrowthConfig = {
    agentsRoot,
    persistDir,
  };

  return [
    // ── Fork ─────────────────────────────────────────────────────────
    {
      name: "fork_agent",
      label: "fork_agent",
      description: "Create a copy of an agent in .lab/ for experimentation.",
      parameters: Type.Object({
        source: Type.String({ description: "Name of the existing agent (e.g., 'coder')" }),
        dest: Type.String({ description: "Name for the new experimental agent (e.g., 'coder-v2')" }),
      }),
      execute: async (toolCallId, args: unknown) => {
        const { source, dest } = args as { source: string; dest: string };

        try {
          const result = forkAgent(growthConfig, source, dest);

          // Register the fork with the manager so it can be called
          await loadAgent(result.destDir);

          return {
            content: [
              {
                type: "text",
                text:
                  `Forked "${source}" to "${dest}" in .lab/\n` +
                  `- Source: ${result.sourceDir}\n` +
                  `- Dest: ${result.destDir}\n` +
                  `- Registered as: ${dest}\n` +
                  `You can now edit files in agents/.lab/${dest}/ and use call("${dest}", ...) to verify.`,
              },
            ],
            details: undefined,
          };
        } catch (err: any) {
          throw new Error(`Failed to fork: ${err.message}`);
        }
      },
    },

    // ── Verify ───────────────────────────────────────────────────────
    {
      name: "verify_agent",
      label: "verify_agent",
      description: "Run a verification task on an agent and return the result.",
      parameters: Type.Object({
        agent: Type.String({ description: "Name of the agent to test (e.g. 'coder-v2')" }),
        task: Type.String({ description: "The prompt/instruction to send" }),
        expected: Type.Optional(
          Type.String({ description: "Optional specific success criteria to check (for logging)" }),
        ),
      }),
      execute: async (toolCallId, args: unknown) => {
        const { agent, task } = args as { agent: string; task: string; expected?: string };
        if (!manager.hasAgent(agent)) {
          throw new Error(`Agent "${agent}" is not registered. Did you fork it first?`);
        }
        try {
          const result = await manager.callAgent(agent, task);
          const output = result.lastAssistantText || "No output";
          return {
            content: [
              {
                type: "text",
                text:
                  `Verification run for ${agent}:\n` +
                  `Task: "${task.slice(0, 100)}..."\n` +
                  `Output: ${output.slice(0, 500)}...\n` +
                  `(Full output omitted for brevity)`,
              },
            ],
            details: undefined,
          };
        } catch (err: any) {
          throw new Error(`Verification failed: ${err.message}`);
        }
      },
    },

    // ── Promote ──────────────────────────────────────────────────────
    {
      name: "promote_agent",
      label: "promote_agent",
      description: "Promote changes from an experimental agent back to the live agent.",
      parameters: Type.Object({
        source: Type.String({ description: "The experimental agent (e.g., 'coder-v2')" }),
        target: Type.String({ description: "The live agent to update (e.g., 'coder')" }),
      }),
      execute: async (toolCallId, args: unknown) => {
        const { source, target } = args as { source: string; target: string };

        try {
          const result = promoteAgent(growthConfig, source, target);

          // Unregister the fork from the manager
          manager.unregister(source);

          // Reload the target agent to pick up changes
          await reloadAgent(target);

          return {
            content: [
              {
                type: "text",
                text:
                  `Promoted "${source}" to "${target}".\n` +
                  `- Copied: ${result.promoted.join(", ")}\n` +
                  `- Deleted: ${result.sourceDir}\n` +
                  `- Reloaded: ${target}\n` +
                  `Changes are now live.`,
              },
            ],
            details: undefined,
          };
        } catch (err: any) {
          throw new Error(`Promote failed: ${err.message}`);
        }
      },
    },

    // ── Discard ──────────────────────────────────────────────────────
    {
      name: "discard_agent",
      label: "discard_agent",
      description: "Discard an experimental agent.",
      parameters: Type.Object({
        agent: Type.String({ description: "The experimental agent to delete (e.g. 'coder-v2')" }),
      }),
      execute: async (toolCallId, args: unknown) => {
        const { agent } = args as { agent: string };

        try {
          discardAgent(growthConfig, agent);

          // Unregister from manager
          manager.unregister(agent);

          return {
            content: [{ type: "text", text: `Discarded experiment "${agent}". Directory and memory deleted.` }],
            details: undefined,
          };
        } catch (err: any) {
          throw new Error(`Discard failed: ${err.message}`);
        }
      },
    },
  ];
}
