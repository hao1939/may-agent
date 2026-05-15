import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => ""),
}));

import {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
  guard,
} from "../shared/guards/finish-guard.js";

const mockedExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  mockedExecFileSync.mockReset();
  mockedExecFileSync.mockReturnValue("");
});

describe("validateFinishDeliverables", () => {
  it("returns valid for null deliverables", () => {
    expect(validateFinishDeliverables(null, "success", "/root").valid).toBe(true);
  });
  it("returns valid for empty array", () => {
    expect(validateFinishDeliverables([], "success", "/root").valid).toBe(true);
  });
  it("returns valid when files exist", () => {
    const root = mkdtempSync(join(tmpdir(), "finish-guard-"));
    try {
      mkdirSync(join(root, "exists"), { recursive: true });
      writeFileSync(join(root, "exists", "file.ts"), "ok");
      const result = validateFinishDeliverables(
        [{ path: "exists/file.ts", description: "test" }],
        "success",
        root,
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("returns missing for non-existent files", () => {
    const result = validateFinishDeliverables(
      [{ path: "missing/file.ts", description: "test" }],
      "success",
      "/root",
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("missing/file.ts");
  });
});

describe("enforceFinishDeliverables", () => {
  it("does nothing for non-success status", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "missing.ts", description: "x" }],
        "partial",
        "/root",
      ),
    ).not.toThrow();
  });
  it("throws for missing deliverables on success", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "missing.ts", description: "x" }],
        "success",
        "/root",
      ),
    ).toThrow("Ghost deliverables");
  });
});

describe("validateVerificationEvidence", () => {
  it("warns when success has no evidence", () => {
    const result = validateVerificationEvidence({ status: "success" });
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });
  it("passes when success has evidence", () => {
    const result = validateVerificationEvidence({
      status: "success",
      verification_evidence: ["Step 1: test passed"],
    });
    expect(result.valid).toBe(true);
  });
  it("passes for non-success without evidence", () => {
    const result = validateVerificationEvidence({ status: "failure" });
    expect(result.valid).toBe(true);
  });
});

describe("enforceVerificationEvidence", () => {
  it("returns warnings array", () => {
    const warnings = enforceVerificationEvidence({ status: "success" });
    expect(warnings).toHaveLength(1);
  });
});

describe("finish-guard handle", () => {
  const makeEvent = (overrides: any = {}): any => ({
    type: "step_done",
    step: "test-step",
    task: "",
    result: { finishResult: { status: "success" } },
    completedSteps: [],
    ...overrides,
  });

  it("returns empty for non-step_done", () => {
    expect(guard.handle({ ...makeEvent(), type: "step_start" })).toEqual([]);
  });
  it("returns empty when no finishResult", () => {
    expect(guard.handle(makeEvent({ result: {} }))).toEqual([]);
  });
  it("returns empty for non-success finish", () => {
    expect(guard.handle(makeEvent({ result: { finishResult: { status: "failure" } } }))).toEqual([]);
  });
  it("returns empty when task doesn't require persistent-task", () => {
    expect(guard.handle(makeEvent({ task: "just a normal task" }))).toEqual([]);
  });
  it("blocks when persistent-task required but not run", () => {
    const demands = guard.handle(
      makeEvent({
        task: 'You must use persistent-task workflow',
        result: { finishResult: { status: "success" }, messages: [] },
      }),
    );
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("passes when persistent-task was run via tool call", () => {
    const demands = guard.handle(
      makeEvent({
        task: 'You must use persistent-task workflow',
        result: {
          finishResult: { status: "success" },
          messages: [
            {
              content: [
                {
                  type: "toolCall",
                  name: "workflow",
                  arguments: { action: "run", name: "persistent-task" },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(demands).toEqual([]);
  });
  it("detects persistent-task requirement from project: field", () => {
    const demands = guard.handle(
      makeEvent({
        task: 'project: agents/shared/projects/my-project\ngoal: do stuff',
        result: { finishResult: { status: "success" }, messages: [] },
      }),
    );
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("detects persistent-task via tool_use format", () => {
    const demands = guard.handle(
      makeEvent({
        task: 'run the persistent-task workflow',
        result: {
          finishResult: { status: "success" },
          messages: [
            {
              content: [
                {
                  type: "tool_use",
                  name: "workflow",
                  input: { action: "run", name: "persistent-task" },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(demands).toEqual([]);
  });
  it("detects persistent-task via result text", () => {
    const demands = guard.handle(
      makeEvent({
        task: 'use persistent-task workflow',
        result: {
          finishResult: { status: "success" },
          lastAssistantText: "persistent-task workflow.run completed after 3 iterations",
          messages: [],
        },
      }),
    );
    expect(demands).toEqual([]);
  });

  it("warns but does not block when only unrelated agents worktree dirt exists", () => {
    const root = mkdtempSync(join(tmpdir(), "finish-guard-dirty-"));
    try {
      const agentsDir = join(root, "agents");
      mkdirSync(join(agentsDir, ".git"), { recursive: true });
      mkdirSync(join(agentsDir, "scout"), { recursive: true });
      writeFileSync(join(agentsDir, "scout", "other.md"), "other agent work");
      mockedExecFileSync.mockReturnValue("?? scout/other.md\n");

      const demands = guard.handle(makeEvent({
        agentName: "dev",
        projectRoot: root,
        result: { finishResult: { status: "success" }, messages: [] },
      }));

      expect(demands).toHaveLength(1);
      expect(demands[0].type).toBe("warn");
      expect(demands[0].reason).toContain("unrelated dirty path");
      expect(demands[0].reason).toContain("scout/other.md");
      expect(demands.some((d) => d.type === "block")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies session-touched dirty paths separately from unrelated dirt", () => {
    const root = mkdtempSync(join(tmpdir(), "finish-guard-touched-"));
    try {
      const agentsDir = join(root, "agents");
      mkdirSync(join(agentsDir, ".git"), { recursive: true });
      mkdirSync(join(agentsDir, "dev"), { recursive: true });
      mkdirSync(join(agentsDir, "scout"), { recursive: true });
      writeFileSync(join(agentsDir, "dev", "own.md"), "session work");
      writeFileSync(join(agentsDir, "scout", "other.md"), "other agent work");
      mockedExecFileSync.mockReturnValue("?? dev/own.md\n?? scout/other.md\n");

      const demands = guard.handle(makeEvent({
        agentName: "dev",
        projectRoot: root,
        result: {
          finishResult: { status: "success" },
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "toolCall",
                  name: "write",
                  arguments: { path: "agents/dev/own.md", content: "session work" },
                },
              ],
            },
          ],
        },
      }));

      expect(demands).toHaveLength(1);
      expect(demands[0].type).toBe("warn");
      expect(demands[0].reason).toContain("Session-touched dirty path(s): dev/own.md");
      expect(demands[0].reason).toContain("Unrelated: scout/other.md");
      expect(demands.some((d) => d.type === "block")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
