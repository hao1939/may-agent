import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentWorkflowDirForProjectApp } from "./sdk-impl.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `project-workflow-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

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
      const expected = join(root, "alpha-project.app", "agents", "aks-explorer", "workflows");
      mkdirSync(expected, { recursive: true });

      expect(agentWorkflowDirForProjectApp(root, "alpha-project", "aks-explorer")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a conventional directory by agent.json identity", () => {
    const root = tempRoot();
    try {
      const agentDir = join(root, "alpha-project.app", "agents", "owner");
      const expected = join(agentDir, "workflows");
      mkdirSync(expected, { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({ name: "aks-explorer" }),
      );

      expect(agentWorkflowDirForProjectApp(root, "alpha-project", "aks-explorer")).toBe(expected);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
