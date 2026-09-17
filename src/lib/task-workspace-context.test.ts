import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { prepareTaskWorkspaceContext } from "./task-workspace-context.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import type { SubagentDefinition } from "./types.js";

function context(root: string, appId = "example", attemptId = "attempt-1"): TaskExecutionContext {
  return {
    taskBinding: { appId, taskId: "../same/task", generation: 1, attemptId },
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    reconciliation: {
      appId, taskId: "../same/task", generation: 1, resourceVersion: 3,
      outcome: "Investigate the failed check", acceptance: ["Cite the source"],
      input: { context: { sourceRoot: root, omittedFact: "retained-full-input" } },
      events: { items: [], truncated: true },
    },
    // A live capability must never be serialized, even accidentally.
    taskRead: { get: () => { throw new Error("not a materialization read"); } },
  } as unknown as TaskExecutionContext;
}

test("Task entry preserves discovery, scopes attempts and excludes provider/live capabilities", () => {
  const root = mkdtempSync(join(tmpdir(), "may-task-entry-"));
  try {
    const c = context(root);
    const definition = {
      name: "reviewer", description: "Review", domain: "code", tools: [],
      apiKey: "provider-secret-must-not-appear", model: { apiKey: "also-private" },
      agentDir: join(root, "agents", "reviewer"),
      skillCatalog: { skills: new Map([["hidden", { name: "hidden", description: "Omitted skill", canonicalPath: "/example/hidden/SKILL.md" }]]) },
    } as unknown as SubagentDefinition;
    const brief = prepareTaskWorkspaceContext(c, root, [definition]);
    if (!("taskFile" in brief)) throw new Error(brief.error);
    const entry = readFileSync(brief.taskFile, "utf8");
    const snapshot = readFileSync(join(dirname(brief.taskFile), "context.json"), "utf8");
    const catalog = readFileSync(join(dirname(brief.taskFile), "catalog.json"), "utf8");
    expect(entry).toContain("context.json");
    expect(entry).toContain("nextCursor");
    expect(entry).toContain('"action":"get"');
    expect(snapshot).toContain("retained-full-input");
    expect(JSON.parse(snapshot).reconciliation.events.truncated).toBe(true);
    expect(catalog).toContain("/example/hidden/SKILL.md");
    expect(snapshot + catalog + entry).not.toContain("provider-secret");
    expect(snapshot + catalog + entry).not.toContain("also-private");
    expect(snapshot).not.toContain("taskRead");
    expect(prepareTaskWorkspaceContext(c, root, [])).toBe(brief);
    for (const other of [context(root, "another-app"), context(root, "example", "attempt-2")]) {
      const next = prepareTaskWorkspaceContext(other, root, []);
      if (!("taskFile" in next)) throw new Error(next.error);
      expect(next.taskFile).not.toBe(brief.taskFile);
      expect(next.taskFile.startsWith(join(root, "task-context"))).toBe(true);
    }
    expect(readFileSync(brief.taskFile, "utf8")).toBe(entry);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("navigation failure reports a usable fallback without invoking Task capabilities", () => {
  const root = mkdtempSync(join(tmpdir(), "may-task-entry-failure-"));
  try {
    const file = join(root, "not-a-directory");
    writeFileSync(file, "existing data");
    const c = context(root);
    expect(prepareTaskWorkspaceContext(c, file, [])).toEqual({
      error: "Task workspace brief could not be saved; use supplied context and Task reads.",
    });
    expect(c.reconciliation.input).toEqual({ context: { sourceRoot: root, omittedFact: "retained-full-input" } });
    expect(readFileSync(file, "utf8")).toBe("existing data");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
