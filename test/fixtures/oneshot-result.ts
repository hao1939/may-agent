import { SubagentManager } from "../../src/lib/manager.js";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { runOneshotMode } from "../../src/app/modes/oneshot.js";
import { fakeModel } from "./model.js";

const manager = new SubagentManager({
  persistDir: process.argv[2]!,
  agentRunFactory: (config) => {
    const agent = createAgentRun(config);
    agent.prompt = async () => {
      if (process.argv[3] === "failure") throw new Error("fixture execution failed");
      agent.state.messages.push({ role: "assistant", content: [{ type: "text", text: "fixture answer" }] } as any);
    };
    return agent;
  },
});
manager.register({ name: "fixture", description: "fixture", domain: "test", model: fakeModel(), tools: [] });
process.exitCode = await runOneshotMode({
  manager,
  agentName: "fixture",
  task: "test result",
  timeoutMinutes: 1,
  formatDurationMs: String,
});
