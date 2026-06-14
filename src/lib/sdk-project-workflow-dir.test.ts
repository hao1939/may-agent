import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { projectWorkflowDirFor, agentWorkflowDirForProjectApp } from "./sdk-impl.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `project-workflow-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

describe("projectWorkflowDirFor", () => {
  it("resolves owner/project ids to projects/<project>/workflows", () => {
    const root = tempRoot();
    try {
      const expected = join(root, "aks-rp-e2e", "workflows");
      mkdirSync(expected, { recursive: true });

      expect(projectWorkflowDirFor(root, "aks-explorer/aks-rp-e2e")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers Project App V2 .app/workflows when present", () => {
    const root = tempRoot();
    try {
      const expected = join(root, "aks-rp-e2e", ".app", "workflows");
      const legacy = join(root, "aks-rp-e2e", "workflows");
      mkdirSync(expected, { recursive: true });
      mkdirSync(legacy, { recursive: true });

      expect(projectWorkflowDirFor(root, "aks-explorer/aks-rp-e2e")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers Project App V3 sibling app workflows when present", () => {
    const root = tempRoot();
    try {
      const expected = join(root, "aks-rp-e2e.app", "workflows");
      const legacy = join(root, "aks-rp-e2e", "workflows");
      mkdirSync(expected, { recursive: true });
      mkdirSync(legacy, { recursive: true });

      expect(projectWorkflowDirFor(root, "aks-rp-e2e")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers exact nested project ids when that workflow directory exists", () => {
    const root = tempRoot();
    try {
      const exact = join(root, "team", "nested", "workflows");
      const short = join(root, "nested", "workflows");
      mkdirSync(exact, { recursive: true });
      mkdirSync(short, { recursive: true });

      expect(projectWorkflowDirFor(root, "team/nested")).toBe(exact);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the old direct project id layout", () => {
    const root = tempRoot();
    try {
      expect(projectWorkflowDirFor(root, "platform")).toBe(join(root, "platform", "workflows"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("agentWorkflowDirForProjectApp", () => {
  it("finds project-app agent workflow dir (V3 sibling layout)", () => {
    const root = tempRoot();
    try {
      const expected = join(root, "scout-knowledge-lib.app", "agents", "scout", "workflows");
      mkdirSync(expected, { recursive: true });

      expect(agentWorkflowDirForProjectApp(root, "scout-knowledge-lib", "scout")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns undefined when no project-app agent workflow dir exists", () => {
    const root = tempRoot();
    try {
      expect(agentWorkflowDirForProjectApp(root, "scout-knowledge-lib", "scout")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns undefined when projectId is missing", () => {
    const root = tempRoot();
    try {
      expect(agentWorkflowDirForProjectApp(root, undefined, "scout")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("handles owner/project id format", () => {
    const root = tempRoot();
    try {
      const expected = join(root, "aks-rp-e2e.app", "agents", "aks-explorer", "workflows");
      mkdirSync(expected, { recursive: true });

      expect(agentWorkflowDirForProjectApp(root, "aks-rp-e2e", "aks-explorer")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
