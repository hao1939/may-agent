import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectAppTaskAction } from "@may-agent/sdk/legacy";
import { validateAksTaskAction } from "./app.js";
import {
  decideDomainWriteRouting,
  recordDomainWritePreflight,
} from "./domain-write-routing.js";
import { assertIsolatedWriteDispatch } from "./agents/owner/workflows/lib/write-dispatch-guard.js";

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

const exactCommit = "0123456789abcdef0123456789abcdef01234567";

function createAction(input: Record<string, unknown>): ProjectAppTaskAction {
  return {
    kind: "create-task",
    id: "domain/prepared-source-test",
    parentId: "group/domain-work",
    outcome: "Exercise prepared-source admission.",
    acceptance: ["The action is admitted or rejected before materialization."],
    mode: "achieve",
    outputs: [],
    priority: "P2",
    workflow: "spec-live-reconciliation",
    input,
  };
}

function updateAction(input: Record<string, unknown>): ProjectAppTaskAction {
  return {
    kind: "update-task",
    taskId: "domain/prepared-source-test",
    expectedGeneration: 1,
    workflow: "spec-live-reconciliation",
    input,
  };
}

describe("AKS task-action prepared-source preflight", () => {
  for (const [kind, action] of [
    [
      "create",
      createAction({ sourceBranch: "origin/dev", sourceCommit: exactCommit }),
    ],
    [
      "update",
      updateAction({ sourceBranch: "origin/dev", sourceCommit: exactCommit }),
    ],
  ] as const) {
    it(`rejects evaluator origin/dev on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toContain("dedicated task/ branch");
    });
  }

  for (const [kind, action] of [
    ["create", createAction({ specId: "spec.example" })],
    ["update", updateAction({ specId: "spec.example" })],
  ] as const) {
    it(`accepts an omitted prepared-source pair on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toBeNull();
    });
  }

  for (const [kind, action] of [
    [
      "create",
      createAction({ sourceBranch: "task/example", sourceCommit: exactCommit }),
    ],
    [
      "update",
      updateAction({
        sourceBranch: "refs/heads/task/example",
        sourceCommit: exactCommit,
      }),
    ],
  ] as const) {
    it(`accepts a dedicated branch and exact commit on the ${kind} path`, () => {
      expect(validateAksTaskAction(action)).toBeNull();
    });
  }

  it("rejects a branch without its exact commit", () => {
    expect(
      validateAksTaskAction(createAction({ sourceBranch: "task/example" })),
    ).toContain("sourceBranch and input.sourceCommit together");
  });

  it("rejects a commit without its branch", () => {
    expect(
      validateAksTaskAction(updateAction({ sourceCommit: exactCommit })),
    ).toContain("sourceBranch and input.sourceCommit together");
  });

  it("rejects a non-exact commit", () => {
    expect(
      validateAksTaskAction(
        createAction({
          sourceBranch: "task/example",
          sourceCommit: "deadbeef",
        }),
      ),
    ).toContain("exact 40-character Git commit");
  });
});

describe("AKS domain write routing preflight", () => {
  function domainAction(
    workflow?: string,
    outcome = "Edit repository source and commit the bounded repair.",
  ): ProjectAppTaskAction {
    return {
      kind: "create-task",
      id: "domain/write-routing-test",
      parentId: "group/domain-work",
      outcome,
      acceptance: ["Publish the accepted source change."],
      mode: "achieve",
      outputs: [],
      priority: "P1",
      owner: "aks-explorer",
      ...(workflow ? { workflow } : {}),
      input: {},
    };
  }

  it("rejects an ordinary unbound owner task that requires source writes", () => {
    expect(validateAksTaskAction(domainAction())).toContain(
      "ordinary unbound owner execution is read-only",
    );
  });

  it("routes a learned write workflow to its declared task workspace", () => {
    expect(
      validateAksTaskAction(domainAction("domain-task-execution")),
    ).toBeNull();
  });

  it("keeps ordinary read-only owner judgment supported", () => {
    const action = domainAction(
      undefined,
      "Inspect current repository evidence without editing, committing, or publishing source.",
    );
    action.acceptance = ["Return a read-only disposition with exact evidence."];
    expect(validateAksTaskAction(action)).toBeNull();
  });

  it("rejects a symlink-equivalent canonical workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "canonical-workspace-link-"));
    roots.push(root);
    const canonical = join(root, "canonical");
    const link = join(root, "workspace-link");
    mkdirSync(canonical);
    symlinkSync(canonical, link, "dir");
    expect(() =>
      assertIsolatedWriteDispatch({
        workspaceDir: link,
        projectDir: canonical,
        cwd: link,
      }),
    ).toThrow("refused canonical workspace");
  });

  it("records task and runtime identity with canonical preflight state and decision", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-attribution-"));
    roots.push(root);
    const appDir = join(root, "sample.app");
    const projectDir = join(root, "sample");
    mkdirSync(projectDir, { recursive: true });
    Bun.spawnSync(["git", "init", "-b", "dev", projectDir]);
    Bun.spawnSync([
      "git",
      "-C",
      projectDir,
      "config",
      "user.email",
      "test@example.com",
    ]);
    Bun.spawnSync(["git", "-C", projectDir, "config", "user.name", "Test"]);
    writeFileSync(join(projectDir, "README.md"), "base\n");
    Bun.spawnSync(["git", "-C", projectDir, "add", "README.md"]);
    Bun.spawnSync(["git", "-C", projectDir, "commit", "-m", "base"]);
    const action = domainAction() as Extract<
      ProjectAppTaskAction,
      { kind: "create-task" }
    >;
    action.input = {
      attemptId: "attempt-5672281",
      sessionId: "session-5672281",
      workflowRunId: "workflow-5672281",
    };
    const decision = decideDomainWriteRouting(action);
    recordDomainWritePreflight(action, decision, appDir, projectDir);
    const record = JSON.parse(
      readFileSync(
        join(appDir, ".state/audit/domain-write-preflight.jsonl"),
        "utf8",
      ).trim(),
    );
    expect(record).toMatchObject({
      taskId: "domain/write-routing-test",
      attemptId: "attempt-5672281",
      sessionId: "session-5672281",
      workflowRunId: "workflow-5672281",
      workflow: null,
      decision: "reject-unbound-writer",
    });
    expect(record.canonicalPreflightHead).toMatch(/^[0-9a-f]{40}$/);
    expect(record.canonicalPreflightStatus).toBe("");
  });
});
