import { SubagentManager } from "../src/lib/index.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";

// Use a known model from pi-ai, override baseUrl to go through litellm
const model = getModel("anthropic", "claude-sonnet-4-20250514");
// litellm wildcard will route github_copilot/* — but we need to override the model id
// to one copilot supports. Use the model object directly with a custom id.
const proxyModel = {
  ...model,
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });

manager.register({
  name: "greeter",
  description: "Says hello",
  domain: "greeting",
  systemPrompt: "You are a helpful assistant. Keep responses very short (one sentence).",
  model: proxyModel,
  tools: [],
  apiKey: "not-needed",
});

const sid = manager.run("greeter", "Say hello and tell me what 2+2 is.");

console.log("Session started:", sid);

const result = await manager.waitFor(sid);
console.log("Status:", result?.status);
console.log("Error:", result?.error);
console.log("Response:", result?.lastAssistantText);
