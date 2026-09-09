import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CronEntry } from "../../lib/cron-tool.js";
import type { EventEnvelope } from "../../lib/handler-context.js";
import { SubagentManager } from "../../lib/manager.js";
import { closeDb } from "../../lib/requests.js";
import type { Cron } from "../cron.js";
import { EventBus } from "../event-bus.js";
import { loadHandlersForAgentCrons } from "./handler-loader.js";

type Handler = (event?: EventEnvelope) => Promise<void>;
type Resolver = (entry: CronEntry) => Promise<Handler | undefined>;
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function setup(entries: CronEntry[]) {
  const root = mkdtempSync(join(tmpdir(), "handler-registration-"));
  roots.push(root);
  const agentDir = join(root, "projects", "sample.app", "agents", "owner");
  const handlersDir = join(agentDir, "handlers");
  mkdirSync(handlersDir, { recursive: true });
  const handlers = new Map<string, Handler>();
  let resolver!: Resolver;
  const bus = new EventBus();
  const events: Array<{ type: string; data?: unknown }> = [];
  bus.subscribe((event) => events.push(event));
  const cron = {
    getEntries: () => entries,
    getConfigPath: () => join(agentDir, "cron.json"),
    hasHandler: (name: string) => handlers.has(name),
    registerHandler: (name: string, handler: Handler) => handlers.set(name, handler),
    setHandlerResolver: (next: Resolver) => {
      resolver = next;
    },
    triggerNow: () => false,
  } as unknown as Cron;
  const load = () =>
    loadHandlersForAgentCrons({
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      persistDir: root,
      projectRoot: root,
      manager: new SubagentManager({ persistDir: root }),
      bus,
      agentCrons: new Map([["owner", cron]]),
    });
  const resolve = async (entry: CronEntry) => {
    const before = new Map(handlers);
    const handler = await resolver(entry);
    expect(handlers).toEqual(before); // Preparation must not publish a stale handler.
    if (handler) handlers.set(entry.name, handler);
    return Boolean(handler);
  };
  return { root, handlersDir, handlers, events, load, resolve };
}

const handlerSource = `
export function create(ctx, entry) {
  return async event => ctx.sdk.emit("fixture.handler-ran", {
    entry: entry.name, marker: entry.handlerConfig?.marker, input: event?.data,
    capabilities: Object.keys(ctx.sdk).sort(),
  });
}
`;

describe("shared handler registration", () => {
  for (const mode of ["startup", "dynamic"] as const) {
    it(`executes a standalone workflow handler registered at ${mode}`, async () => {
      const entry: CronEntry = {
        name: "standalone-heartbeat",
        enabled: true,
        category: "heartbeat",
        handler: { workflow: "heartbeat", agent: "owner", projectId: "sample", task: "Bounded observation" },
      };
      const fixture = setup(mode === "startup" ? [entry] : []);
      const workflowDir = join(fixture.handlersDir, "..", "workflows");
      mkdirSync(workflowDir);
      writeFileSync(
        join(workflowDir, "heartbeat.ts"),
        `
export const name = "heartbeat";
export const description = "Standalone registration fixture";
export async function execute(ctx) { return ctx.done("Observed"); }
`,
      );
      expect((await fixture.load()).errors).toEqual([]);
      if (mode === "dynamic") expect(await fixture.resolve(entry)).toBe(true);
      await fixture.handlers.get(entry.name)!();
      expect(fixture.events).toContainEqual(
        expect.objectContaining({
          type: "handler.workflow_dispatched",
          data: expect.objectContaining({
            handler: entry.name,
            workflow: "heartbeat",
            status: "done",
            workflowRunId: expect.any(String),
          }),
        }),
      );
    });

    it(`preserves per-entry configuration, events and restricted capabilities at ${mode}`, async () => {
      const entries = ["one", "two"].map((name) => ({
        name,
        enabled: true,
        handler: "shared",
        handlerConfig: { marker: name },
      }));
      const fixture = setup(mode === "startup" ? entries : []);
      writeFileSync(join(fixture.handlersDir, "shared.ts"), handlerSource);
      const initial = await fixture.load();
      if (mode === "dynamic") {
        for (const entry of entries) expect(await fixture.resolve(entry)).toBe(true);
        expect(initial).toEqual({ registered: [], errors: [] });
      } else {
        expect(initial).toEqual({ registered: ["owner:one", "owner:two"], errors: [] });
      }
      const event = { type: "fixture.input", source: "test", owner: "agent:owner", data: { value: 42 } };
      for (const entry of entries) await fixture.handlers.get(entry.name)!(event);
      const reports = fixture.events.filter((event) => event.type === "fixture.handler-ran");
      expect(reports.map((report) => report.data)).toEqual(
        entries.map((entry) => ({
          entry: entry.name,
          marker: entry.name,
          input: { value: 42 },
          capabilities: ["emit", "getDb", "log", "message", "metrics", "paths", "query"],
        })),
      );
      const prior = fixture.handlers.get("one");
      expect(await fixture.load()).toEqual({ registered: [], errors: [] });
      expect(fixture.handlers.get("one")).toBe(prior);
    });

    for (const [failure, source] of [
      ["missing file", null],
      ["missing create export", "export const notAHandler = true;"],
      ["import failure", 'throw new Error("fixture import failed");'],
    ] as const) {
      it(`reports each affected entry on ${failure} at ${mode}`, async () => {
        const entries = ["one", "two"].map((name) => ({ name, enabled: true, handler: "broken" }));
        const fixture = setup(mode === "startup" ? entries : []);
        if (source !== null) writeFileSync(join(fixture.handlersDir, "broken.ts"), source);
        const initial = await fixture.load();
        if (mode === "dynamic") {
          for (const entry of entries) expect(await fixture.resolve(entry)).toBe(false);
          expect(initial).toEqual({ registered: [], errors: [] });
        } else {
          expect(initial.registered).toEqual([]);
          expect(initial.errors).toHaveLength(1);
        }
        expect(fixture.handlers.size).toBe(0);
        const failures = fixture.events.filter((event) => event.type === "handler.load-failed");
        expect(failures).toHaveLength(2);
        for (let i = 0; i < entries.length; i++) {
          expect(failures[i]).toMatchObject({
            source: "handler-loader",
            owner: "agent:owner",
            data: {
              handler: entries[i].name,
              agent: "owner",
              path: expect.stringContaining(fixture.handlersDir),
              error: expect.any(String),
            },
          });
        }
      });
    }
  }

  it("recovers a missing file through the dynamic resolver without mutating the startup report", async () => {
    const entry = { name: "late", enabled: true, handler: "late" };
    const fixture = setup([entry]);
    const initial = await fixture.load();
    const initialReport = structuredClone(initial);
    writeFileSync(join(fixture.handlersDir, "late.ts"), handlerSource);
    expect(await fixture.resolve(entry)).toBe(true);
    await fixture.handlers.get("late")!();
    expect(initial).toEqual(initialReport);
    expect(fixture.events.some((event) => event.type === "fixture.handler-ran")).toBe(true);
    expect(await fixture.resolve({ name: "no-handler", enabled: true })).toBe(false);
    expect(await fixture.resolve({ name: "empty-handler", enabled: true, handler: "" })).toBe(false);
  });
});
