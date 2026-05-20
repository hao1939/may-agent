import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "../../projects/platform/workflows/platform-iteration.ts";

describe("project iteration stall handling", () => {
  it("keeps replannable no-milestone stalls out of project blocked state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "project-stall-"));
    try {
      writeFileSync(join(dir, "project.md"), [
        "---",
        "id: p",
        "owner: may",
        "status: active",
        "iteration: 0",
        "stop_reason: ",
        "resume_condition: ",
        "---",
        "",
        "# Project",
        "",
        "## Goal",
        "Keep making progress through owner replanning.",
        "",
        "## Current State",
        "Active.",
        "",
        "## Next Action",
        "Investigate source and write the next hypothesis.",
        "",
        "## Plan",
        "1. 🔄 Investigate source-first hypothesis",
        "",
      ].join("\n"), "utf-8");
      writeFileSync(join(dir, "journal.md"), "# Journal\n\n", "utf-8");

      const dispatched: string[] = [];
      const escalations: string[] = [];
      const ctx = {
        task: `project: ${dir}\nowner: may\nworker: may\nmaxIterations: 5\nreviewEvery: 1`,
        agent: "may",
        emit() {},
        dispatchEvent(event: string) {
          dispatched.push(event);
        },
        async runAgent(_agent: string, prompt: string) {
          if (prompt.includes("Your response MUST start")) {
            return {
              status: "success",
              lastAssistantText: [
                "PIVOT — milestones did not move, but source-first replanning remains available.",
                "",
                "CURRENT_STATE_UPDATE:",
                "Active: source-first replanning remains available.",
                "",
                "NEXT_ACTION_UPDATE:",
                "Investigate source and write the next hypothesis.",
              ].join("\n"),
            };
          }
          return { status: "success", lastAssistantText: "Worker made no milestone movement." };
        },
        summarize(result: { lastAssistantText?: string }) {
          return result.lastAssistantText ?? "";
        },
        done(message: string) {
          return { status: "done", message };
        },
        escalate(message: string) {
          escalations.push(message);
          return { status: "escalated", message };
        },
      };

      const result = await execute(ctx as any);
      const content = readFileSync(join(dir, "project.md"), "utf-8");

      expect(result.status).toBe("done");
      expect(escalations).toEqual([]);
      expect(dispatched).not.toContain("project.blocked");
      expect(content).toContain("status: paused");
      expect(content).not.toContain("status: blocked");
      expect(content).not.toContain("Blocked: 5 consecutive iterations without milestone progress");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
