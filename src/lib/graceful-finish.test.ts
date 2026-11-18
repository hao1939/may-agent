import { Type } from "typebox";
import { afterEach, expect, test } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, type Context } from "@earendil-works/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { taskAgentResultSchema } from "@may-agent/sdk/app";
import { createAgentRun, createFinishTool, currentAgentSessionId } from "@may-agent/sdk/runtime";
import { prepareAgentExecution, executePreparedAgent } from "./agent-execution.js";
import { closeDb } from "./db/connection.js";
import { SubagentManager } from "./manager.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(join(root, "state"));
    rmSync(root, { recursive: true, force: true });
  }
});
function root() {
  const dir = mkdtempSync(join(tmpdir(), "may-finish-or-cancel-"));
  roots.push(dir);
  return dir;
}
function call(name: string, args: Record<string, unknown>, id = name) {
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "done", reason: "toolUse", message: usageReply({ stopReason: "toolUse", content: [{ type: "toolCall", id, name, arguments: args }] }) });
  return stream;
}
function abortedReply() {
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "error", reason: "aborted", error: usageReply({ stopReason: "aborted", errorMessage: "Aborted" }) });
  return stream;
}
const progress = { state: "waiting", continue: true, summary: "Draft retained; review remains", facts: ["draft:retained"] };
const partial = { status: "blocked", summary: progress.summary, output: progress, facts: progress.facts };
function stalledTool(onStopped: () => void = () => {}): AgentTool {
  return { name: "hold", label: "hold", description: "Hold a cooperative operation", parameters: Type.Object({}), async execute(_id, _params, signal) {
    if (!signal) throw new Error("Missing execution cancellation");
    if (!signal.aborted) await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    onStopped();
    return { content: [{ type: "text", text: "Draft retained. Review interrupted; completion unknown." }] };
  } };
}

test("direct execution keeps normal tools available until a valid finish", async () => {
  const dir = root();
  let usefulWork = 0;
  let effects = 0;
  const prepared = prepareAgentExecution({
    definition: { name: "owner", description: "fixture", domain: "test", model: fakeModel(), systemPrompt: "Use supplied results.", tools: [
      { name: "slow-work", label: "slow-work", description: "Useful work that crosses the retired early cutoff", parameters: Type.Object({}), async execute() {
        await new Promise((resolve) => setTimeout(resolve, 1_700)); usefulWork++; return { content: [{ type: "text", text: "useful work completed" }] };
      } },
      { name: "effect", label: "effect", description: "A normal follow-up effect", parameters: Type.Object({}), async execute() {
        effects++; return { content: [{ type: "text", text: "follow-up effect completed" }] };
      } },
      createFinishTool({ projectRoot: dir }),
    ] },
    sessionId: "direct-finish-or-cancel", projectRoot: dir, task: "Implement and review", outputSchema: taskAgentResultSchema,
  });
  const contexts: Context[] = [];
  prepared.runner.streamFn = (_model, context, options) => {
    contexts.push(JSON.parse(JSON.stringify(context)) as Context);
    expect(options?.signal?.aborted).toBe(false);
    if (contexts.length === 1) return call("slow-work", {});
    if (contexts.length === 2) return call("effect", {});
    if (contexts.length === 3) return call("finish", { status: "done", summary: "Missing required Task result" }, "invalid");
    expect(JSON.stringify(context.messages)).toContain("finish() error");
    return call("finish", partial, "valid");
  };
  const result = await executePreparedAgent(prepared, { timeoutMs: 2_000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe("done");
  expect(result.structuredResult).toMatchObject(progress);
  expect(usefulWork).toBe(1);
  expect(effects).toBe(1);
  expect(contexts).toHaveLength(4);
  expect(JSON.stringify(contexts)).not.toContain("Bounded completion guardrail");
  expect(JSON.stringify(contexts)).not.toContain("Execution work allowance ended");
});

test("the real deadline interrupts provider work without requesting a finish report", async () => {
  const dir = root();
  let modelCalls = 0;
  const prepared = prepareAgentExecution({ definition: { name: "owner", description: "fixture", domain: "test", model: fakeModel(), systemPrompt: "Return evidence.", tools: [createFinishTool({ projectRoot: dir })] }, sessionId: "actual-deadline", projectRoot: dir, task: "Implement and review", outputSchema: taskAgentResultSchema });
  prepared.runner.streamFn = (_model, _context, options) => {
    modelCalls++;
    const stream = createAssistantMessageEventStream();
    const abort = () => stream.push({ type: "error", reason: "aborted", error: usageReply({ stopReason: "aborted", errorMessage: "Aborted" }) });
    if (options?.signal?.aborted) abort();
    else options?.signal?.addEventListener("abort", abort, { once: true });
    return stream;
  };
  const result = await executePreparedAgent(prepared, { timeoutMs: 100 });
  expect(modelCalls).toBe(1);
  expect(result.status).toBe("interrupted");
  expect(result.error).toBe("Agent timed out after 100ms");
  expect(result.finishResult).toBeUndefined();
  expect(result.structuredResult).toBeUndefined();
});

test("explicit Stop drains nested helpers and retains their interruption evidence", async () => {
  const dir = root();
  const controller = new AbortController();
  const leafEntered = Promise.withResolvers<void>();
  const manager = new SubagentManager({ persistDir: join(dir, "state"), projectRoot: dir, agentRunFactory: (config) => {
    const name = config.initialState?.model?.id;
    return createAgentRun({ ...config, streamFn: (_model, _context, options) => {
      if (options?.signal?.aborted) return abortedReply();
      return name === "leaf" ? call("hold", {}) : call("agents", { action: "call", agent: name === "owner" ? "global/helper" : "global/leaf", input: { prompt: "Review" } });
    } });
  } });
  for (const name of ["owner", "helper", "leaf"]) {
    const hold = stalledTool();
    manager.register({ name, description: "fixture", domain: "test", model: { ...fakeModel(), id: name }, systemPrompt: "Return available review evidence.", tools: name === "leaf" ? [{ ...hold, execute: (...args) => { leafEntered.resolve(); return hold.execute(...args); } }] : [manager.createAgentsTool({ getCallerSessionId: () => currentAgentSessionId(name) })] });
  }
  const ownerId = manager.run("owner", "Review", { signal: controller.signal, timeoutMs: 5_000 });
  try {
    await leafEntered.promise;
    const ids = new Map([...manager.activeSessions.values()].map((session) => [session.agentName, session.sessionId]));
    expect(ids.size).toBe(3);
    controller.abort(new Error("Explicit Stop"));
    expect((await manager.waitFor(ownerId)).status).toBe("interrupted");
    expect(manager.status()).toEqual([]);
    for (const caller of ["helper", "owner"]) {
      const receipt = manager.progress(ids.get(caller)!, 100).find((message) => message.role === "toolResult" && message.toolName === "agents");
      expect(receipt?.role).toBe("toolResult");
      if (receipt?.role !== "toolResult") throw new Error("Missing helper receipt");
      const content = receipt.content.find((part) => part.type === "text");
      if (content?.type !== "text") throw new Error("Missing helper receipt text");
      expect(JSON.parse(content.text)).toEqual({ status: "error", summary: "Caller execution stopped" });
    }
    expect(JSON.stringify(manager.progress(ids.get("leaf")!, 100))).toContain("Review interrupted; completion unknown");
  } finally {
    controller.abort(new Error("Fixture cleanup"));
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
  }
});
