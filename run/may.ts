import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager, createReadTool, createWriteTool, createExecTool } from "../src/index.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Load knowledge files for system prompt
const domain = readFileSync(`${PROJECT_ROOT}/agents/may/knowledge/domain.md`, "utf-8");
const toolsIndex = readFileSync(`${PROJECT_ROOT}/agents/may/tools/INDEX.md`, "utf-8");
const systemPrompt = [domain, toolsIndex].join("\n\n---\n\n");

// Model: Opus 4.6 via litellm/Copilot proxy
const model = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

const manager = new SubagentManager();

manager.register({
  name: "may",
  description: "Supervisor agent — implements and evolves may-agent",
  domain: "may-agent development",
  systemPrompt,
  model,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
  ],
  apiKey: "not-needed",
});

function attachEvents(sid: string): void {
  manager.subscribe(sid, (event) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          process.stdout.write("\n[may] ");
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case "message_end":
        if (event.message.role === "assistant") {
          process.stdout.write("\n");
        }
        break;
      case "tool_execution_start":
        console.log(`\n[tool:${event.toolName}] ${JSON.stringify(event.args).slice(0, 200)}`);
        break;
      case "tool_execution_end": {
        if (event.isError) {
          console.log(`[tool:${event.toolName}] ERROR`);
        } else {
          const text = event.result?.content?.[0]?.text ?? "";
          const preview = text.slice(0, 200);
          console.log(`[tool:${event.toolName}] ${preview}${text.length > 200 ? "..." : ""}`);
        }
        break;
      }
    }
  });
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => { closed = true; });

function ask(): Promise<string | null> {
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => {
    rl.question("\nyou> ", (answer) => resolve(answer.trim()));
  });
}

// First message: from args or interactive prompt
let firstMessage = process.argv.slice(2).join(" ");
if (!firstMessage) {
  const input = await ask();
  if (!input) { rl.close(); process.exit(0); }
  firstMessage = input;
}

// Start session — single session for the whole conversation
const sid = manager.run("may", firstMessage);
attachEvents(sid);
await manager.waitFor(sid);

// Conversation loop — follow-ups go to the same session (same Agent, full context)
while (!closed) {
  const input = await ask();

  if (!input || input === "exit" || input === "quit") {
    break;
  }

  manager.send(sid, input);
  await manager.waitFor(sid);
}

rl.close();
