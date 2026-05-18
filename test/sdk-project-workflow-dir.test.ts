import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { projectWorkflowDirFor } from "../src/lib/sdk-impl.ts";

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
