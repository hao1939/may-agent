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

function context(input: {
  appDir: string;
  projectDir: string;
  trigger: Record<string, unknown>;
  agentResult?: unknown;
  dispatched?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
}) {
  const { type, target, data, ...legacyData } = input.trigger;
  return {
    input: {},
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "runtime/project-stall-review",
      generation: 1,
      resourceVersion: 1,
      agent: "app-ops",
      mode: "maintain",
      outcome: "Review project liveness",
      acceptance: ["One structured liveness judgment is emitted."],
      input: {},
      children: { live: [], completed: [] },
      events: {
        items: [
          {
            observedAt: "2026-08-21T00:00:00.000Z",
            event: {
              type,
              target,
              data: {
                ...legacyData,
                ...(data && typeof data === "object" ? data : {}),
              },
            },
          },
        ],
        truncated: false,
      },
    },
    workspace: {
      appRoot: input.appDir,
      projectRoot: input.projectDir,
      root: input.projectDir,
      output: input.projectDir,
    },
    agents: {
      async call() {
        return (
          input.agentResult ?? {
            id: "agent:test",
            kind: "agent",
            status: "done",
            summary: "done",
          }
        );
      },
    },
    events: {
      async emit(event: { type: string; data: Record<string, unknown> }) {
        input.dispatched?.push({ type: event.type, payload: event.data });
      },
    },
    done(summary: string, output?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      };
    },
  } as any;
}

describe("project stall review", () => {
  test("returns owner fallback for the wrong event", async () => {
    const ws = await workspace();
    const result = await execute(
      context({
        appDir: ws.appDir,
        projectDir: ws.projectDir,
        trigger: { type: "wrong.event" },
      }),
    );
    expect(result).toMatchObject({ output: { state: "needs-agent" } });
  });

  test("collects and judges without repairing, assigning, or pulsing the graph", async () => {
    const ws = await workspace();
    const before = await readFile(ws.treePath, "utf8");
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({
        appDir: ws.appDir,
        projectDir: ws.projectDir,
        trigger: {
          type: "project.stall.review.requested",
          reason: "manual",
          mode: "risk-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          stallReview: {
            judgment: "needs-work",
            rootCause: "runnable work is not moving",
            nextProjectMove: "controller should reconcile the ready task",
            whyNotMoving: "no current attempt",
            evidence: ["one runnable leaf"],
          },
          message: "Structured stall judgment.",
        },
      }),
    );

    expect(result).toMatchObject({
      output: { state: "converged", actions: [] },
    });
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.stall.reviewed",
    ]);
    expect(await readFile(ws.treePath, "utf8")).toBe(before);
  });
});
