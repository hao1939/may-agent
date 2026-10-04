import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, createAssistantMessageEventStream, type ToolCall } from "@earendil-works/pi-ai";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { prepareAgentExecution, executePreparedAgent } from "./agent-execution.js";
import { createAgentRun } from "./agent-runner.js";
import { createFinishTool } from "./tools/lifecycle.js";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./db/connection.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
const args = { status: "success", summary: "Measured", verification_facts: ["Fixture measurement"], result: { value: 7 } };
const call = (id = "finish", arguments_ = args): ToolCall => ({ type: "toolCall", id, name: "finish", arguments: arguments_ });
function stream(calls: ToolCall[]) {
  const result = createAssistantMessageEventStream();
  const message = usageReply({ stopReason: calls.length ? "toolUse" : "stop", content: calls });
  result.push({ type: "done", reason: message.stopReason as "toolUse" | "stop", message });
  return result;
}
function fixture(mode: "plain" | "required" | "schema" = "plain") {
  const root = mkdtempSync(join(tmpdir(), "may-finish-invocation-"));
  roots.push(root);
  const definition = {
    name: "helper", description: "Synthetic helper", domain: "tests", systemPrompt: "Report the measurement",
    model: fakeModel(), tools: [createFinishTool({ agentName: "helper", projectRoot: root })],
  };
  const prepared = prepareAgentExecution({
    definition, projectRoot: root, sessionId: "finish-fixture", task: "Measure once",
    ...(mode === "required" ? { requireFinish: true } : {}),
    ...(mode === "schema" ? { outputSchema: Type.Object({ value: Type.Number() }) } : {}),
  });
  return { root, definition, prepared };
}

test.each(["plain", "required", "schema"] as const)("a %s helper stops after its accepted finish", async (mode) => {
  const { prepared } = fixture(mode);
  let requests = 0;
  prepared.runner.streamFn = () => stream(++requests <= 3 ? [call()] : []);
  const result = await executePreparedAgent(prepared);
  expect(result.status).toBe("done");
  expect(result.finishResult?.summary).toBe("Measured");
  expect(requests).toBe(1);
});

test("a rejected finish stays correctable without making another call after acceptance", async () => {
  const { prepared } = fixture();
  let requests = 0;
  prepared.runner.streamFn = () => {
    requests++;
    return stream(requests > 3 ? [] : [call(`finish-${requests}`, requests === 1 ? { ...args, verification_facts: [] } : args)]);
  };
  const result = await executePreparedAgent(prepared);
  expect(result.status).toBe("done");
  expect(result.finishResult?.summary).toBe("Measured");
  expect(requests).toBe(2);
});

test.each(["steering", "follow-up"] as const)("finish fences a mixed batch and preserves queued %s for a later invocation", async (kind) => {
  const { prepared } = fixture();
  const effects: string[] = [];
  prepared.runner.initialState!.tools!.push({
    name: "effect", label: "effect", description: "Record a synthetic effect", parameters: Type.Object({ id: Type.String() }),
    execute: async (_id, { id }) => {
      effects.push(id);
      return { content: [{ type: "text", text: id }] };
    },
  });
  let requests = 0;
  prepared.runner.streamFn = () => {
    requests++;
    // Pi delivers follow-up input after a normal turn yields; it remains queued
    // across finish. Steering is delivered at the start of the next invocation.
    if (kind === "follow-up" && requests === 2) return stream([]);
    return stream(requests > 3 ? [] : [
      { type: "toolCall", id: `before-${requests}`, name: "effect", arguments: { id: `before-${requests}` } },
      call(`finish-${requests}`),
      { type: "toolCall", id: `after-${requests}`, name: "effect", arguments: { id: `after-${requests}` } },
    ]);
  };
  // Model context refresh must not turn the accepted finish into another obligation.
  prepared.runner.transformContext = async (messages) => [...messages, {
    role: "user", timestamp: Date.now(), content: [{ type: "text", text: "Current Task facts: unchanged" }],
  }];
  const agent = createAgentRun(prepared.runner);
  agent.subscribe((event) => {
    if (event.type !== "tool_execution_end" || event.toolCallId !== "finish-1") return;
    const message = { role: "user" as const, timestamp: Date.now(), content: [{ type: "text" as const, text: "New requirement" }] };
    if (kind === "steering") agent.steer(message);
    else agent.followUp(message);
  });
  await agent.prompt(prepared.prompt);
  expect(requests).toBe(1);
  expect(effects).toEqual(["before-1"]);
  expect(agent.state.messages.some((message) => message.role === "toolResult" && message.toolCallId === "after-1" && message.isError)).toBe(true);
  await agent.continue();
  const next = kind === "steering" ? 2 : 3;
  expect(requests).toBe(next);
  expect(effects).toEqual(["before-1", `before-${next}`]);
  expect(agent.state.messages.some((message) => message.role === "user" && JSON.stringify(message.content).includes("New requirement"))).toBe(true);
});

test("the managed ordinary-helper path keeps the result without continuing model work", async () => {
  const { root, definition } = fixture();
  let requests = 0;
  const manager = new SubagentManager({
    persistDir: root,
    agentRunFactory: (config) => createAgentRun({ ...config, streamFn: () => stream(++requests <= 3 ? [call()] : []) }),
  });
  manager.register(definition);
  const session = manager.run("helper", "Measure once");
  try {
    expect(await manager.waitFor(session)).toMatchObject({ status: "done", lastAssistantText: "Measured" });
    expect(requests).toBe(1);
  } finally {
    manager.cancel(session);
    await manager.waitFor(session);
  }
});

test.each([false, true])(
  "caller admission permits correction in the managed invocation (schema: %s)",
  async (schema) => {
    const { root, definition } = fixture();
    let requests = 0;
    const validated: unknown[] = [];
    let sessionId: string | undefined;
    const manager = new SubagentManager({
      persistDir: root,
      agentRunFactory: (config) =>
        createAgentRun({
          ...config,
          streamFn: () => {
            requests++;
            return stream(
              requests > 3
                ? []
                : [
                    call(`finish-${requests}`, {
                      ...args,
                      result: { value: requests === 1 ? -1 : 7 },
                    }),
                  ],
            );
          },
        }),
    });
    manager.register(definition);
    try {
      const result = await manager.callAgent("helper", "Measure once", {
        ...(schema ? { outputSchema: Type.Object({ value: Type.Number() }) } : {}),
        sessionStarted: (id) => {
          sessionId = id;
        },
        validateOutput(value) {
          validated.push(value);
          return (value as { value: number }).value < 0
            ? "result.value must be nonnegative; return { value: 7 }"
            : null;
        },
      });
      expect(result.status).toBe("done");
      expect(result.structuredResult).toEqual({ value: 7 });
      expect(validated).toEqual([{ value: -1 }, { value: 7 }]);
      expect(requests).toBe(2);
    } finally {
      if (sessionId) {
        manager.cancel(sessionId);
        await manager.waitFor(sessionId);
      }
    }
  },
);
