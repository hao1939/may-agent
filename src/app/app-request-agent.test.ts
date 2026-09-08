import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, appRequestAgentResultSchema, defineApp, type AppRequest } from "@may-agent/sdk";
import { Check } from "typebox/value";
import { prepareAgentExecution } from "../lib/agent-execution.js";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import type { SubagentManager } from "../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../lib/types.js";
import { createReadTool } from "../lib/tools/read.js";
import { createEditTool } from "../lib/tools/edit.js";
import { createWriteTool } from "../lib/tools/write.js";
import { createBashTool } from "../lib/tools/bash.js";
import { createFinishTool } from "../lib/tools/lifecycle.js";
import type { AppRegistry } from "./app-registry.js";
import { createAppRequestAgentResolver } from "./app-request-agent.js";
import { AppInboxHost } from "./app-inbox-host.js";
import { listAppInboxChildren, readAppConversationResource } from "./app-inbox-store.js";

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
  const roots: string[] = [];
  afterEach(() => {
    databases.splice(0).forEach((db) => db.close());
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

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
    expect(options).toMatchObject({ requireFinish: true, toolPolicy: "app-agent-full", recoveryOwner: "app-inbox" });
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

  it("allows useful direct work without making tool use or App availability a handoff requirement", async () => {
    const { prompt } = await attempt();
    expect(prompt).toContain("investigate, edit, and verify directly");
    expect(prompt).toContain("background continuation, later steering, or restart-safe coordination");
    expect(prompt).toContain("Creating a Task is not delegation");
    expect(prompt).toContain("Do not hand off just because an App has a matching name");
    expect(prompt).toContain("Inspect current state before changing it or retrying an interrupted action");
    expect(prompt).toContain("does not by itself authorize a Task effect");
    expect(prompt).not.toContain("only when this App is genuinely the best owner");
  });

  it.each(["done", "interrupted"] as const)(
    "runs direct file work with real bounded tools and handles a %s attempt honestly",
    async (status) => {
      const root = mkdtempSync(join(tmpdir(), "may-direct-work-"));
      roots.push(root);
      writeFileSync(join(root, "note.txt"), "A small typo: teh.\n");
      const db = openDatabase(":memory:");
      databases.push(db);
      applyDbSchema(db);
      const definition: SubagentDefinition = {
        name: "may",
        description: "Direct work fixture",
        domain: "tests",
        systemPrompt: "Use only the authorized fixture files.",
        projectRoot: root,
        model: { contextWindow: 10_000 } as SubagentDefinition["model"],
        tools: [
          createReadTool(root),
          createEditTool(root),
          createWriteTool(root),
          createBashTool(root),
          createFinishTool({ agentName: "may", projectRoot: root }),
          ...["background_exec", "checkpoint", "cron", "message"].map((name) => ({
            name,
            label: name,
            description: name,
            parameters: Type.Object({}),
            execute: async () => {
              throw new Error(`Unexpected lifecycle tool: ${name}`);
            },
          })),
        ],
      };
      let calls = 0;
      const decision = { ...answer, summary: "Corrected and verified note.txt", response: "Fixed the typo." };
      // Script the model's choices, but use the real resolver, tool policy,
      // file tools, shell, and request persistence. No model service is used.
      const manager = {
        getAgentDefinition: () => definition,
        callAgentDefinition: async (agent: SubagentDefinition, prompt: string, options: CallOptions) => {
          calls += 1;
          const prepared = prepareAgentExecution({
            ...options,
            definition: agent,
            projectRoot: root,
            sessionId: "direct-work",
            task: prompt,
          });
          expect(prepared.tools.map((tool) => tool.name)).toEqual([
            "read",
            "edit",
            "write",
            "bash",
            "finish",
            "conversation_context",
          ]);
          expect(prepared.runner.beforeToolCall).toBeFunction();
          const run = async (name: string, input: unknown) =>
            prepared.tools.find((tool) => tool.name === name)!.execute(name, input);
          await run("read", { path: "note.txt" });
          await run("edit", { path: "note.txt", oldText: "teh", newText: "the" });
          await run("write", { path: "result.txt", content: "Corrected the typo.\n" });
          const verified = await run("bash", { command: "test -s result.txt && test -s note.txt", timeout: 5 });
          expect(verified.content).toBeDefined();
          expect(readFileSync(join(root, "note.txt"), "utf8")).toBe("A small typo: the.\n");
          expect(Check(options.outputSchema!, decision)).toBe(true);
          return {
            status,
            structuredResult: decision,
            ...(status === "interrupted" ? { error: "Fixture interrupted after editing" } : {}),
          };
        },
      } as unknown as SubagentManager;
      const registry = {
        snapshot: () => ({ entries: [may, owner].map((app) => ({ appDir: app.id, definition: app })) }),
      } as unknown as AppRegistry;
      const options = {
        db,
        apps: [may, owner],
        resolveRequest: createAppRequestAgentResolver({ manager, registry, db }),
        attachTask: async () => {
          throw new Error("Direct work must not create a Task");
        },
        onRequestFollowUp: () => {
          throw new Error("Direct work must not hand off");
        },
      };
      const host = new AppInboxHost(options);
      const input = {
        ...request,
        input: { kind: "message", data: { text: "Fix and verify the typo in note.txt" } },
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: 1,
      };
      host.admit(input);
      const result = await host.reconcileOnce("may");
      expect(calls).toBe(1);
      expect(listAppInboxChildren(db, request.id)).toEqual([]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 0 });
      if (status === "interrupted") {
        expect(result.errors).toEqual([expect.stringContaining("Fixture interrupted after editing")]);
        expect(host.get(request.id)?.status).not.toBe("done");
        expect(host.get(request.id)?.result).toBeUndefined();
        expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
          expect.objectContaining({ author: { kind: "human", id: "human-1" }, text: input.input.data.text }),
        ]);
        return;
      }
      expect(result.errors).toEqual([]);
      expect(host.get(request.id)).toMatchObject({ status: "done", result: { response: decision.response } });
      // Duplicate delivery and reopening the Host must not repeat accepted work.
      const reopened = new AppInboxHost(options);
      reopened.admit(input);
      expect((await reopened.reconcileOnce("may")).errors).toEqual([]);
      expect(calls).toBe(1);
      expect(reopened.get(request.id)?.result?.response).toBe(decision.response);
      expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
        expect.objectContaining({ author: { kind: "human", id: "human-1" }, text: input.input.data.text }),
        expect.objectContaining({ id: "result:turn-1", author: { kind: "agent", id: "may" }, text: decision.response }),
      ]);
    },
  );

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
    expect(options.toolPolicy).toBe("app-agent-deputy");
    expect(prompt).toContain("final result comes after the work finishes");
    expect(prompt).not.toContain("Do not return dependencies");
    expect(prompt).toContain(child.summary);
    const exactWait = await attempt({ ...request, dependency: { kind: "app", id: "old-child", status: "unknown" } });
    expect(exactWait.options.outputSchema).toBe(appRequestAgentResultSchema);
    expect(exactWait.options.toolPolicy).toBe("app-agent-deputy");
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
    expect(options.toolPolicy).toBe("app-agent-deputy");
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
