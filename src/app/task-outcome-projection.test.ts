import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskView } from "@may-agent/sdk/app";
import { projectTaskOutcomes, readTaskOutcomeManifest, type TaskOutcomeManifest } from "./task-outcome-projection.js";

function task(id: string, status: TaskView["status"] = "waiting"): TaskView {
  return { id, status, generation: 1, outcome: `Legacy outcome ${id}`, evidence: [`task:${id}`] };
}

describe("Task outcome shadow projection", () => {
  it("projects the reviewed 48-identity shape into 15 outcomes without losing or changing a legacy view", () => {
    const groups = Array.from({ length: 15 }, (_, index) => ({
      id: `outcome-${String(index + 1).padStart(2, "0")}`,
      outcome: `Durable outcome ${index + 1}`,
      taskIds: Array.from({ length: index < 3 ? 4 : 3 }, (_, member) => `legacy-${index}-${member}`),
    }));
    const manifest: TaskOutcomeManifest = { version: 1, groups };
    const source = groups.flatMap((group) => group.taskIds.map((id) => task(id)));
    expect(source).toHaveLength(48);
    const before = structuredClone(source);

    const page = projectTaskOutcomes(source, manifest);

    expect(page.sourceCount).toBe(48);
    expect(page.outcomeCount).toBe(15);
    expect(page.outcomes.flatMap((outcome) => outcome.memberTaskIds).sort()).toEqual(source.map((item) => item.id).sort());
    expect(page.outcomes.flatMap((outcome) => outcome.members)).toEqual(expect.arrayContaining(before));
    expect(source).toEqual(before);
  });

  it("falls back losslessly for unmapped Tasks and disables cleanly by using the unchanged legacy source", () => {
    const source = [task("mapped"), task("new-unmapped", "running")];
    const page = projectTaskOutcomes(source, {
      version: 1,
      groups: [{ id: "known", outcome: "Known outcome", taskIds: ["mapped"] }],
    });
    expect(page.outcomes).toHaveLength(2);
    expect(page.outcomes.find((item) => item.id === "legacy:new-unmapped")?.ungrouped).toBe(true);
    expect(source.map((item) => item.id)).toEqual(["mapped", "new-unmapped"]);
  });

  it("rejects ambiguous manifests before serving a grouped view", () => {
    const root = mkdtempSync(join(tmpdir(), "task-outcomes-"));
    try {
      mkdirSync(join(root, "tasks"));
      writeFileSync(
        join(root, "tasks", "outcome-projection.json"),
        JSON.stringify({
          version: 1,
          groups: [
            { id: "one", outcome: "One", taskIds: ["same"] },
            { id: "two", outcome: "Two", taskIds: ["same"] },
          ],
        }),
      );
      expect(() => readTaskOutcomeManifest(root)).toThrow("appears in more than one outcome group");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
