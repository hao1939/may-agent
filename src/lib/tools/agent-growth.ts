import { Type } from "@mariozechner/pi-ai";
import { type AgentTool } from "@mariozechner/pi-agent-core";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { SubagentManager } from "../manager.js";

export interface AgentGrowthToolOptions {
  agentsRoot: string;
  manager: SubagentManager;
  loadAgent: (agentDir: string) => void;
  reloadAgent: (name: string) => void;
}

/**
 * Creates the agent growth toolset: fork, verify, promote, discard.
 */
export function createAgentGrowthTools(opts: AgentGrowthToolOptions): AgentTool[] {
  const { agentsRoot, manager, loadAgent, reloadAgent } = opts;
  const labDir = resolve(agentsRoot, ".lab");

  // Ensure lab dir exists
  if (!existsSync(labDir)) {
    mkdirSync(labDir, { recursive: true });
  }

  return [
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
        const sourceDir = resolve(agentsRoot, source);
        const destDir = resolve(labDir, dest);

        if (!existsSync(sourceDir)) {
          throw new Error(`Source agent "${source}" not found at ${sourceDir}`);
        }
        if (existsSync(destDir)) {
          throw new Error(`Destination "${dest}" already exists at ${destDir}`);
        }

        try {
          cpSync(sourceDir, destDir, { recursive: true });
          const configPath = join(destDir, "agent.json");
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          config.name = dest;
          writeFileSync(configPath, JSON.stringify(config, null, 2));
          loadAgent(destDir);
          return {
            content: [
              {
                type: "text",
                text:
                  `Forked "${source}" to "${dest}" in .lab/\n` +
                  `- Source: ${sourceDir}\n` +
                  `- Dest: ${destDir}\n` +
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
        const sourceDir = resolve(labDir, source);
        const targetDir = resolve(agentsRoot, target);

        if (!existsSync(sourceDir)) {
          throw new Error(`Source "${source}" not found in .lab/`);
        }
        if (!existsSync(targetDir)) {
          throw new Error(`Target "${target}" not found in agents/`);
        }

        try {
          const artifacts = ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md", "knowledge", "agent.json"];
          const promoted: string[] = [];
          for (const artifact of artifacts) {
            const srcPath = join(sourceDir, artifact);
            const destPath = join(targetDir, artifact);
            if (existsSync(srcPath)) {
              if (artifact === "agent.json") {
                const srcConfig = JSON.parse(readFileSync(srcPath, "utf-8"));
                const destConfig = JSON.parse(readFileSync(destPath, "utf-8"));
                const newConfig = { ...srcConfig, name: destConfig.name };
                writeFileSync(destPath, JSON.stringify(newConfig, null, 2));
              } else {
                cpSync(srcPath, destPath, { recursive: true, force: true });
              }
              promoted.push(artifact);
            }
          }
          manager.unregister(source);
          rmSync(sourceDir, { recursive: true, force: true });
          reloadAgent(target);
          return {
            content: [
              {
                type: "text",
                text:
                  `Promoted "${source}" to "${target}".\n` +
                  `- Copied: ${promoted.join(", ")}\n` +
                  `- Deleted: ${sourceDir}\n` +
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
    {
      name: "discard_agent",
      label: "discard_agent",
      description: "Discard an experimental agent.",
      parameters: Type.Object({
        agent: Type.String({ description: "The experimental agent to delete (e.g. 'coder-v2')" }),
      }),
      execute: async (toolCallId, args: unknown) => {
        const { agent } = args as { agent: string };
        const agentDir = resolve(labDir, agent);

        if (!existsSync(agentDir)) {
          throw new Error(`Agent "${agent}" not found in .lab/`);
        }
        try {
          manager.unregister(agent);
          rmSync(agentDir, { recursive: true, force: true });
          return {
            content: [{ type: "text", text: `Discarded experiment "${agent}". Directory deleted.` }],
            details: undefined,
          };
        } catch (err: any) {
          throw new Error(`Discard failed: ${err.message}`);
        }
      },
    },
  ];
}
