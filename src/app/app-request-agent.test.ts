import { afterEach, describe, expect, it } from "bun:test";
import { Type, appRequestAgentResultSchema, defineApp, type AppRequest } from "@may-agent/sdk";
import { Check } from "typebox/value";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import type { SubagentManager } from "../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../lib/types.js";
import type { AppRegistry } from "./app-registry.js";
import { createAppRequestAgentResolver } from "./app-request-agent.js";
import { AppInboxHost } from "./app-inbox-host.js";
import { listAppInboxChildren } from "./app-inbox-store.js";

const input = (kind: string) => Type.Object({ kind: Type.Literal(kind), data: Type.Object({ text: Type.String() }) });
const may = defineApp({
  id: "may",
  version: 1,
  agent: "may",
  inputSchema: Type.Union([input("message"), input("goal")]),
  requests: { mode: "agent", inputKinds: ["message"] },
  task: (request) => ({ kind: "existing", taskId: request.id }),
  tasks: {},
});
const owner = defineApp({
  id: "owner",
  version: 1,
  agent: "owner",
  inputSchema: input("work"),
  task: (request) => ({ kind: "existing", taskId: request.id }),
  tasks: {},
});
const request: AppRequest = {
  id: "turn-1",
  source: { kind: "human", id: "human-1" },
  input: { kind: "message", data: { text: "Review the options" } },
};
const answer = { summary: "Answered", response: "Here are the options.", topic: { kind: "none" } };
const child = {
  kind: "app" as const,
  id: "child-1",
  requestId: "child-1",
  appId: "owner",
  status: "done" as const,
  summary: "The owner verified the work",
};

describe("conversational attempt contract", () => {
  const databases: SqliteDb[] = [];
  afterEach(() => databases.splice(0).forEach((db) => db.close()));

  async function attempt(current = request, app = may) {
    const db = openDatabase(":memory:");
    databases.push(db);
    applyDbSchema(db);
    let captured: { prompt: string; options: CallOptions } | undefined;
    const calls: Array<{ prompt: string; options: CallOptions }> = [];
    const manager = {
      getAgentDefinition: () => ({ name: "may", tools: [] }) as unknown as SubagentDefinition,
      callAgentDefinition: async (_definition: SubagentDefinition, prompt: string, options: CallOptions) => {
        captured = { prompt, options };
        calls.push(captured);
        return { status: "done", structuredResult: answer };
      },
    } as unknown as SubagentManager;
    const registry = {
      snapshot: () => ({ entries: [may, owner].map((definition) => ({ appDir: definition.id, definition })) }),
    } as unknown as AppRegistry;
    const resolve = createAppRequestAgentResolver({ manager, registry, db });
    expect(await resolve({ app, request: current })).toEqual(answer);
    return { ...captured!, db, resolve, calls };
  }

  it("offers only direct handoff for new May turns without changing the public compatibility schema", async () => {
    const { prompt, options } = await attempt();
    const schema = options.outputSchema!;
    expect(Check(schema, answer)).toBe(true);
    const waiting = { ...answer, dependencies: [{ id: "child", appId: "owner", input: { kind: "work", data: {} } }] };
    expect(Check(schema, waiting)).toBe(false);
    expect(Check(appRequestAgentResultSchema, waiting)).toBe(true);
    expect(Check(schema, { ...answer, dependencies: [] })).toBe(false);
    expect(prompt).toContain("request completes");
    expect(prompt).not.toContain("Choose dependency appId");
    expect(options).toMatchObject({ requireFinish: true, toolPolicy: "app-agent-deputy", recoveryOwner: "app-inbox" });
    // Schema narrowing must retain ordinary feedback and cancellation contracts.
    expect(
      Check(schema, {
        ...answer,
        followUp: {
          outcome: "Review",
          acceptance: ["Verified"],
          appId: "owner",
          input: { kind: "work", data: {} },
          task: { appId: "owner", taskId: "work-1" },
        },
      }),
    ).toBe(true);
    expect(
      Check(schema, {
        ...answer,
        taskControls: [{ kind: "cancel", appId: "owner", taskId: "work-1", reason: "Human asked" }],
      }),
    ).toBe(true);
  });

  it("supplies May's own durable input contract without offering recursive conversation input", async () => {
    const { prompt } = await attempt();
    const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1].split("\n```")[0]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "may")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["goal"]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "owner")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["work"]);
  });

  it("keeps the child-result protocol for retained requests after the App adopts direct handoff", async () => {
    const { prompt, options } = await attempt({ ...request, dependencies: [child] });
    expect(options.outputSchema).toBe(appRequestAgentResultSchema);
    expect(prompt).toContain("final result comes after the work finishes");
    expect(prompt).not.toContain("Do not return dependencies");
    expect(prompt).toContain(child.summary);
    const exactWait = await attempt({ ...request, dependency: { kind: "app", id: "old-child", status: "unknown" } });
    expect(exactWait.options.outputSchema).toBe(appRequestAgentResultSchema);
  });

  it("does not mistake another Topic's work or a focused Task for this request's child wait", async () => {
    const { options } = await attempt({
      ...request,
      dependencies: [],
      openRequests: [{ requestId: "older-turn", topicId: "old-topic", dependencies: [child] }],
      focusedTask: { appId: "owner", task: { kind: "task", id: "work-1", status: "waiting" } },
    });
    expect(Check(options.outputSchema!, { ...answer, dependencies: [] })).toBe(false);
  });

  it("preserves the all-input conversational App protocol", async () => {
    const legacy = { ...may, requests: { mode: "agent" as const }, task: undefined, tasks: undefined };
    const { prompt, options } = await attempt(request, legacy);
    expect(options.outputSchema).toBe(appRequestAgentResultSchema);
    expect(prompt).toContain("final result comes after the work finishes");
  });

  it("finishes the same retained child wait after recreating the Host with the current May definition", async () => {
    const { db, resolve, calls } = await attempt();
    const legacy = { ...may, requests: { mode: "agent" as const }, task: undefined, tasks: undefined };
    let completed = false;
    let attachments = 0;
    const capabilities = {
      db,
      attachTask: async () => {
        attachments += 1;
        return { taskId: "owner-work" };
      },
      readDependency: async () => ({
        kind: "task" as const,
        id: "owner-work",
        status: completed ? ("done" as const) : ("running" as const),
        ...(completed ? { summary: "Owner verified the result" } : {}),
      }),
    };
    const before = new AppInboxHost({
      ...capabilities,
      apps: [legacy, owner],
      resolveRequest: async () => ({
        summary: "The owner must review the work",
        topic: { kind: "new", title: "Review work" },
        dependencies: [{ id: "review", appId: "owner", input: { kind: "work", data: { text: "Review" } } }],
      }),
    });
    before.admit({ ...request, appId: "may", conversationId: "may:primary", conversationSequence: 1 });
    expect((await before.reconcileOnce("may")).errors).toEqual([]);
    expect((await before.reconcileOnce("owner")).errors).toEqual([]);
    const retained = listAppInboxChildren(db, request.id);
    expect(retained).toHaveLength(1);
    expect(before.get(request.id)?.waitingOn).toEqual({ kind: "app", id: `children:${request.id}` });

    const after = new AppInboxHost({ ...capabilities, apps: [may, owner], resolveRequest: resolve });
    completed = true;
    expect(after.wake({ kind: "task", id: "owner-work" })).toBe(1);
    expect((await after.reconcileOnce("owner")).errors).toEqual([]);
    expect((await after.reconcileOnce("may")).errors).toEqual([]);
    expect(calls.at(-1)?.options.outputSchema).toBe(appRequestAgentResultSchema);
    expect(calls.at(-1)?.prompt).toContain("Owner verified the result");
    expect(after.get(request.id)).toMatchObject({ status: "done", result: { response: answer.response } });
    expect(listAppInboxChildren(db, request.id).map(({ id }) => id)).toEqual(retained.map(({ id }) => id));
    expect(attachments).toBe(1);
  });
});
