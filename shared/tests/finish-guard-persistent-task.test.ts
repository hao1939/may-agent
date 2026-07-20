import { describe, expect, it } from "bun:test";
import { guard } from "../guards/finish-guard";

function finishEvent(task: string, messages: unknown[] = []): any {
  return {
    type: "step_done",
    task,
    result: {
      finishResult: { status: "success", verification_evidence: ["test"] },
      messages,
      lastAssistantText: "done",
    },
  };
}

function persistentTaskBlocks(
  task: string,
  messages: unknown[] = [],
): string[] {
  return guard
    .handle(finishEvent(task, messages))
    .filter(
      (demand) => demand.type === "block" && demand.reason.includes("FM-3.4"),
    )
    .map((demand) => demand.reason);
}

describe("finish-guard persistent-task selection", () => {
  it("does not infer persistent-task from a project path", () => {
    expect(
      persistentTaskBlocks(
        "Reconcile the task.\nproject: /app/projects/sample",
      ),
    ).toEqual([]);
  });

  it("blocks an explicit persistent-task request without a workflow call", () => {
    expect(
      persistentTaskBlocks(
        "Use the persistent-task workflow for this multi-session project.",
      ),
    ).toHaveLength(1);
    expect(
      persistentTaskBlocks("Run persistent-task workflow for this task."),
    ).toHaveLength(1);
  });

  it("does not treat a negated workflow mention as selection", () => {
    expect(
      persistentTaskBlocks(
        "Do not use the persistent-task workflow; this bounded task runs directly.",
      ),
    ).toEqual([]);
  });

  it("accepts an explicit request after the workflow was actually invoked", () => {
    expect(
      persistentTaskBlocks("Run the persistent-task workflow.", [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              name: "workflow",
              arguments: { action: "run", name: "persistent-task" },
            },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("does not treat an opt-out marker as permission to ignore an explicit request", () => {
    expect(
      persistentTaskBlocks(
        "persistent-task: skip\nYou must use persistent-task for this work.",
      ),
    ).toHaveLength(1);
  });

  it("does not accept prose that merely claims the workflow ran", () => {
    const event = finishEvent("Run the persistent-task workflow.");
    event.result.lastAssistantText =
      "persistent-task workflow completed all iterations";
    const blocks = guard
      .handle(event)
      .filter(
        (demand) => demand.type === "block" && demand.reason.includes("FM-3.4"),
      );
    expect(blocks).toHaveLength(1);
  });
});
