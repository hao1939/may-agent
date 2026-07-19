import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./project-stall-review";

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "stall-review-v2-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  const treePath = join(appDir, ".state", "tasks", "tree.json");
  await writeFile(
    treePath,
    JSON.stringify(
      {
        root_task_id: "project",
        tasks: {
          project: { id: "project", state: "active", children: ["work"] },
          work: {
            id: "work",
            parent_id: "project",
            state: "backlog",
            children: [],
            goal: "Make bounded progress",
            acceptance: ["Evidence exists"],
          },
        },
        resources: {},
      },
      null,
      2,
    ),
  );
  return { appDir, projectDir, treePath };
}

function trigger(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\``;
}

describe("project stall review", () => {
  test("returns owner fallback for the wrong event", async () => {
    const ws = await workspace();
    const result = await execute({
      task: `app: ${ws.appDir}\nproject: ${ws.projectDir}\n${trigger({ type: "wrong.event" })}`,
      agent: "app-ops",
      done: (message: string, output?: unknown) => ({
        status: "done",
        message,
        output,
      }),
    } as any);
    expect(result).toMatchObject({ output: { state: "needs-owner" } });
  });

  test("collects and judges without repairing, assigning, or pulsing the graph", async () => {
    const ws = await workspace();
    const before = await readFile(ws.treePath, "utf8");
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: `app: ${ws.appDir}\nproject: ${ws.projectDir}\n${trigger({ type: "project.stall.review.requested", reason: "manual", mode: "risk-review" })}`,
      agent: "app-ops",
      done: (message: string, output?: unknown) => ({
        status: "done",
        message,
        output,
      }),
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgentSession: async () => ({
        status: "success",
        stallReview: {
          judgment: "needs-work",
          rootCause: "runnable work is not moving",
          nextProjectMove: "controller should reconcile the ready task",
          whyNotMoving: "no current attempt",
          evidence: ["one runnable leaf"],
        },
        message: "Structured stall judgment.",
      }),
      summarize: () => "",
    } as any);

    expect(result).toMatchObject({
      output: { state: "converged", actions: [] },
    });
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.stall.reviewed",
    ]);
    expect(await readFile(ws.treePath, "utf8")).toBe(before);
  });
});
