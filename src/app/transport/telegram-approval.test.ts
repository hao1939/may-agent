import { describe, expect, it } from "bun:test";
import type { HumanTaskView } from "../human-task-service.js";
import { telegramApprovalReply, type TelegramApprovalAnchor } from "./telegram.js";

function proposal(letter: string, revision: number): HumanTaskView {
  return {
    appId: "may",
    taskId: "goal/proposal",
    ref: "abcdef12",
    status: "waiting",
    generation: 1,
    resourceVersion: revision,
    outcome: `Review proposal ${letter}`,
    updatedAt: revision,
    terminal: false,
    cancellable: true,
    diagnostics: {
      conditions: [
        {
          id: `approval-${letter}`,
          condition: {
            spec: {
              type: "project.approval.submitted",
              subject: `id:proposal-${letter}`,
              owner: "human",
              expected: {
                anyOf: ["approve", "reject", "defer"],
                approvalId: `proposal-${letter}`,
                packetHash: letter.repeat(64),
                proposalRevision: revision,
              },
            },
            status: { state: "false" },
          },
        },
      ],
    },
  };
}

const anchorA: TelegramApprovalAnchor = {
  approvalId: "proposal-a",
  packetHash: "a".repeat(64),
  proposalRevision: 1,
};

describe("Telegram exact approval reply", () => {
  it("accepts only a literal allowed decision for the displayed current proposal", () => {
    expect(telegramApprovalReply("approve", proposal("a", 1), anchorA)).toMatchObject({
      decision: "approve",
      approvalId: "proposal-a",
      packetHash: "a".repeat(64),
    });
    expect(telegramApprovalReply("yes", proposal("a", 1), anchorA)).toBeNull();
    expect(telegramApprovalReply("approve if checks pass", proposal("a", 1), anchorA)).toBeNull();
  });

  it("keeps a stale displayed A from deciding replacement B", () => {
    expect(telegramApprovalReply("approve", proposal("b", 2), anchorA)).toBeNull();
    expect(telegramApprovalReply("reject", proposal("b", 2), anchorA)).toBeNull();
    expect(telegramApprovalReply("defer", proposal("b", 2), anchorA)).toBeNull();
  });

  it("does not guess when a Task has multiple unresolved human approvals", () => {
    const ambiguous = proposal("a", 1);
    ambiguous.diagnostics!.conditions.push(proposal("b", 2).diagnostics!.conditions[0]!);
    expect(telegramApprovalReply("approve", ambiguous, anchorA)).toBeNull();
  });
});
