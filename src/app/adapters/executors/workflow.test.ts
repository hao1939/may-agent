import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskHandlerAvailability } from "../../core/tasks/handler-availability.js";
import { createTaskWorkflowRunner } from "./workflow.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("checks the selected named executor without constructing or calling a backend", async () => {
  const available = createTaskHandlerAvailability({
    executors: {
      fixture: async () => {
        throw new Error("Must not execute during lookup");
      },
    },
    inspectWorkflow: () => {
      throw new Error("A named executor needs no workflow files");
    },
  });
  expect(await available({ agent: "owner", handler: "executor:fixture" })).toBeTrue();
  expect(await available({ agent: "owner", handler: "executor:missing" })).toBeFalse();
  expect(await available({ agent: "owner", handler: "unknown:fixture" })).toBeFalse();
});

it("inspects real workflow files and caches only within one recovery pass", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-handler-availability-"));
  roots.push(root);
  mkdirSync(join(root, "owner", "workflows"), { recursive: true });
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: {} as never });
  const makeCheck = () =>
    createTaskHandlerAvailability({
      inspectWorkflow: async (agent, workflow) =>
        (
          await runner.inspect({
            source: {
              projectsRoot: root,
              projectRoot: root,
              agentsRoot: root,
              persistDir: join(root, "state"),
              sharedRoot: join(root, "shared"),
            },
            appDir: join(root, "sample.app"),
            agent,
            workflow,
          })
        ).available,
    });
  const missing = makeCheck();
  const binding = { agent: "owner", handler: "workflow:verify" };
  expect(await missing(binding)).toBeFalse();
  const path = join(root, "owner", "workflows", "verify.ts");
  writeFileSync(
    path,
    `export const name = "verify";
export const description = "Availability fixture";
export function execute() { throw new Error("Must not execute during lookup"); }`,
  );
  expect(await missing(binding)).toBeFalse();
  const repaired = makeCheck();
  expect(await repaired(binding)).toBeTrue();
  expect(await repaired({ ...binding, agent: "other" })).toBeFalse();
  writeFileSync(path, 'export const name = "verify";');
  expect(await repaired(binding)).toBeTrue();
  expect(await makeCheck()(binding)).toBeFalse();
});
