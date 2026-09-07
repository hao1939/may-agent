import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../app/event-bus.js";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./requests.js";
import { buildAgentSDK } from "./sdk-impl.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), "host-sdk-capabilities-"));
  roots.push(root);
  const workflowDir = join(root, "agents", "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  const sdk = buildAgentSDK({
    bus: new EventBus(),
    persistDir: root,
    projectRoot: root,
    agentsRoot: join(root, "agents"),
    sharedRoot: join(root, "shared"),
    projectsRoot: join(root, "projects"),
    agentName: "owner",
    manager: new SubagentManager({ persistDir: root }),
  });
  return { sdk, workflowDir };
}

it("does not construct unused agent-dispatch or escalation capabilities", () => {
  const { sdk } = setup();
  expect(sdk).not.toHaveProperty("runAgent");
  expect(sdk).not.toHaveProperty("escalate");
  for (const capability of ["emit", "message", "getDb", "log", "runWorkflow"] as const) {
    expect(sdk[capability]).toBeFunction();
  }
});

it("still runs a standalone workflow through the shared bounded executor", async () => {
  const { sdk, workflowDir } = setup();
  writeFileSync(
    join(workflowDir, "heartbeat.ts"),
    `
export const name = "heartbeat";
export const description = "Retained standalone workflow adapter";
export async function execute(ctx) { return ctx.done(ctx.input.message); }
`,
  );
  expect(
    await sdk.runWorkflow("heartbeat", "bounded standalone check", { input: { message: "observed" } }),
  ).toMatchObject({ status: "done", summary: "observed", runId: expect.any(String) });
});
