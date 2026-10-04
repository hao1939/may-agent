import { describe, expect, test } from "bun:test";
import { checkCrossEditGuard } from "./cross-edit-guard.js";
import type { FileWritePolicy } from "./file-write-policy.js";

const root = "/tmp/file-policy-fixture";
const config = `${root}/projects/support.app/agents/worker/agent.json`;
const policy: FileWritePolicy = {
  root,
  protectedPaths: ["projects/quality.app/criteria/**"],
  grants: [
    { paths: ["**/agents/*/agent.json"], writers: ["maintainer"] },
    { paths: ["projects/quality.app/criteria/**"], writers: ["reviewer"] },
  ],
};

describe("file-tool policy", () => {
  test("names confer no implicit privileges", () => {
    for (const name of ["may", "alex", "tech-lead", "evaluator", "worker", "maintainer"]) {
      expect(checkCrossEditGuard(config, name, root).blocked).toBe(true);
    }
    expect(checkCrossEditGuard(config, "maintainer", root, policy).blocked).toBe(false);
    expect(checkCrossEditGuard(config, "may", root, policy).blocked).toBe(true);
  });
  test("preserves ordinary own-guidance and cross-agent protection", () => {
    const path = `${root}/projects/support.app/agents/worker/AGENTS.md`;
    expect(checkCrossEditGuard(path, "worker", root).blocked).toBe(false);
    expect(checkCrossEditGuard(path, "other", root).blocked).toBe(true);
    expect(checkCrossEditGuard(`${root}/shared/common-sense.md`, "worker", root).blocked).toBe(true);
    expect(
      checkCrossEditGuard(`${root}/projects/support.app/agents/worker/workspace/note.md`, "other", root).blocked,
    ).toBe(false);
  });
  test("domain protections follow declared paths and retain denies", () => {
    const path = `${root}/projects/quality.app/criteria/rules.md`;
    expect(checkCrossEditGuard(path, "worker", root, policy).blocked).toBe(true);
    expect(checkCrossEditGuard(path, "reviewer", root, policy).blocked).toBe(false);
  });
  test("scope survives App-local cwd and execution worktree rebinding", () => {
    expect(checkCrossEditGuard(config, "maintainer", `${root}/projects/support.app`, policy).blocked).toBe(false);
    expect(checkCrossEditGuard(config, "worker", "/tmp/task-checkout", policy).blocked).toBe(true);
    expect(
      checkCrossEditGuard(
        "/tmp/task-checkout/projects/support.app/agents/worker/agent.json",
        "maintainer",
        "/tmp/task-checkout",
        { ...policy, executionRoot: "/tmp/task-checkout" },
      ).blocked,
    ).toBe(false);
    expect(
      checkCrossEditGuard(`${root}/shared/file-write-policy.json`, "maintainer", root, {
        root,
        protectedPaths: [],
        grants: [{ paths: ["**"], writers: ["maintainer"] }],
      }).blocked,
    ).toBe(true);
  });
  test("installation-relative grants do not expand under an App-local working directory", () => {
    const scoped: FileWritePolicy = {
      root,
      protectedPaths: ["criteria/**"],
      grants: [{ paths: ["agents/*/agent.json"], writers: ["maintainer"] }],
    };
    expect(checkCrossEditGuard(`${root}/agents/worker/agent.json`, "maintainer", root, scoped).blocked).toBe(false);
    expect(checkCrossEditGuard(config, "maintainer", `${root}/projects/support.app`, scoped).blocked).toBe(true);
    expect(checkCrossEditGuard(`${root}/projects/support.app/criteria/rules.md`, "worker", `${root}/projects/support.app`, scoped).blocked).toBe(false);
    const rebound = { ...scoped, executionRoot: "/tmp/task-checkout" };
    expect(checkCrossEditGuard("/tmp/task-checkout/agents/worker/agent.json", "maintainer", "/tmp/task-checkout", rebound).blocked).toBe(false);
    expect(checkCrossEditGuard("/tmp/task-checkout/projects/support.app/agents/worker/agent.json", "maintainer", "/tmp/task-checkout", rebound).blocked).toBe(true);
    expect(checkCrossEditGuard("/tmp/task-checkout/criteria/rules.md", "worker", "/tmp/task-checkout", rebound).blocked).toBe(true);
  });
});
