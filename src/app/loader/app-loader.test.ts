import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAppDefinitionFiles, loadAppDefinitions } from "./app-loader.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = join(tmpdir(), `app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(join(root, "evaluation.app"), { recursive: true });
  mkdirSync(join(root, "empty.app"), { recursive: true });
  return root;
}

describe("canonical App loader", () => {
  it("loads only the canonical app.ts manifest", async () => {
    const root = fixture();
    const modulePath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      modulePath,
      `export default {
        id: "evaluation-canary",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "probe" }, data: { type: "object" }
        } }
      };\n`,
    );

    expect(listAppDefinitionFiles(root)).toEqual([modulePath]);
    const loaded = await loadAppDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary", owner: "evaluator" },
    });
  });

  it("loads one valid canonical manifest", async () => {
    const root = fixture();
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      `export default {
        id: "evaluation-canary", version: 1, owner: "evaluator",
        inputSchema: { type: "object" }
      };\n`,
    );

    const loaded = await loadAppDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary" },
    });
  });

  it("prepares faithful Evaluation and AKS legacy fixtures for canonical and staged legacy hosts", async () => {
    const root = fixture();
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "evaluation", version: 1, owner: "evaluator", description: "legacy",
        budget: { maxConcurrent: 3 },
        schedules: [{ id: "evaluation-pipeline-review", enabled: true, intervalMs: 300000,
          emits: [{ type: "evaluation.pipeline.check", project: "evaluation" }]
        }],
        events: ["evaluation.reviewed"],
        actions: { review: { description: "Review", inputSchema: {}, event: (data) => ({ type: "evaluation.review", data }) } },
        tasks: { accepts: ["evaluation.task"], resolve: (event) => ({ id: "review", outcome: event.type, acceptance: ["done"] }) }
      };\n`,
    );
    mkdirSync(join(root, "alpha-project.app"), { recursive: true });
    writeFileSync(
      join(root, "alpha-project.app", "app.js"),
      `export default {
        id: "alpha-project", version: 1, owner: "app-ops", description: "legacy",
        budget: { maxConcurrent: 4 },
        schedules: [{ id: "task-controller", enabled: true, intervalMs: 60000,
          emits: [{ type: "project.task.tick", project: "alpha-project" }]
        }],
        events: ["project.task.tick"],
        tasks: { accepts: ["project.task.tick"], resolve: () => null }
      };\n`,
    );

    const loaded = await loadAppDefinitions(root);
    const definition = loaded.find(({ definition: app }) => app.id === "evaluation")?.definition;
    const aks = loaded.find(({ definition: app }) => app.id === "alpha-project")?.definition;
    expect(definition).toMatchObject({
      id: "evaluation",
      inputSchema: { type: "object" },
      schedules: [
        {
          id: "evaluation-pipeline-review:1",
          event: { type: "evaluation.pipeline.check", data: {} },
          emits: [{ type: "evaluation.pipeline.check", data: {} }],
        },
      ],
      observations: ["evaluation.reviewed"],
      tasks: { attach: true, subscriptions: ["evaluation.task"], maxConcurrent: 3 },
    });
    expect(aks).toMatchObject({
      id: "alpha-project",
      schedules: [
        {
          id: "task-controller:1",
          event: { type: "project.task.tick", data: {} },
          emits: [{ type: "project.task.tick", data: {} }],
        },
      ],
      tasks: { attach: true, subscriptions: ["project.task.tick"], maxConcurrent: 4 },
    });
    expect(definition?.actions?.review.toInput({ value: "ready" })).toEqual({
      kind: "legacy-action",
      data: {
        actionId: "review",
        event: { type: "evaluation.review", data: { value: "ready" } },
      },
    });
  });

  it("prepares every current project App through the immutable staged SDK bundle path", async () => {
    const stagedSdk = "/app/projects/may-agent/bundle/sdk-9c17ac0bc2332e7f4248b5653a9e981c1ecaa4d8";
    if (!existsSync(stagedSdk) || !existsSync("/app/projects")) return;
    const cacheRoot = mkdtempSync(join(tmpdir(), "app-loader-staged-"));
    roots.push(cacheRoot);
    const previousSdkRoot = process.env.MAY_AGENT_SDK_ROOT;
    process.env.MAY_AGENT_SDK_ROOT = stagedSdk;
    try {
      const loaded = await loadAppDefinitions("/app/projects", {
        forceBundle: true,
        cacheDir: join(cacheRoot, "cache"),
      });
      expect(loaded.length).toBeGreaterThan(0);
      const byId = new Map(loaded.map(({ definition }) => [definition.id, definition]));
      const evaluation = byId.get("evaluation");
      expect(evaluation).toBeDefined();
      const pipelineReview = (evaluation?.schedules ?? []).filter((schedule) =>
        schedule.id.startsWith("evaluation-pipeline-review"),
      );
      expect(pipelineReview.length).toBeGreaterThan(0);
      for (const schedule of pipelineReview) {
        expect((schedule as { emits?: unknown[] }).emits?.length ?? 0).toBeGreaterThan(0);
        expect((schedule as { event?: { type?: string } }).event?.type).toBe("evaluation.pipeline.check");
      }
      expect(byId.get("alpha-project")).toBeDefined();
    } finally {
      if (previousSdkRoot === undefined) delete process.env.MAY_AGENT_SDK_ROOT;
      else process.env.MAY_AGENT_SDK_ROOT = previousSdkRoot;
    }
  });

  it("rejects duplicate App ids before starting the host", async () => {
    const root = fixture();
    mkdirSync(join(root, "second.app"), { recursive: true });
    for (const directory of ["evaluation.app", "second.app"]) {
      writeFileSync(
        join(root, directory, "app.js"),
        `export default { id: "duplicate", version: 1, owner: "owner", inputSchema: {} };\n`,
      );
    }

    await expect(loadAppDefinitions(root)).rejects.toThrow("Duplicate App id: duplicate");
  });
});
