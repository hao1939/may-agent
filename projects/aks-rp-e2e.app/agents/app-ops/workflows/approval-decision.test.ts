import { describe, expect, test } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./approval-decision.js";
import { parseApprovalDecision } from "./lib/approval-decision.js";

const approvalId = "aks-rp-e2e:approval:path:packet";
const waitId = `wait:${approvalId}`;
const message = [
  "[approval-decision] Decision: approve",
  `Approval id: ${approvalId}`,
  `Wait id: ${waitId}`,
  "Project: aks-rp-e2e",
  "Feature path: feature/path",
  "Packet: evidence/packet.md",
].join("\n");

describe("canonical approval decision handling", () => {
  test("parses only a bounded decision with preserved correlation", () => {
    expect(parseApprovalDecision({ content: message })).toMatchObject({
      approvalId,
      waitId,
      project: "aks-rp-e2e",
      pathId: "feature/path",
      packetPath: "evidence/packet.md",
      decision: "approve",
    });
    expect(parseApprovalDecision({ content: "Approve this" })).toBeNull();
  });

  test("publishes the decision fact and closes the source message", async () => {
    const emitted: Record<string, unknown>[] = [];
    {
      const input = {
        content: message,
        sourceMessageEventId: 42,
        sourceMessageOwner: "agent:app-ops",
      };
      const context = {
        input,
        reconciliation: { input },
        events: {
          emit: async (event: Record<string, unknown>) =>
            void emitted.push(event),
        },
        done: (summary: string, output: unknown) => ({
          id: "run",
          kind: "workflow",
          status: "done",
          summary,
          output,
        }),
      } as unknown as WorkflowContext<Record<string, unknown>>;

      const outcome = await execute(context);

      expect(outcome.status).toBe("done");
      expect(emitted.map((event) => event.type)).toEqual([
        "project.approval.submitted",
        "message.resolved",
      ]);
      expect(emitted[0]?.data).toMatchObject({
        approvalId,
        waitId,
        decision: "approve",
      });
      expect(emitted[1]?.data).toMatchObject({
        openEventId: 42,
        outcome: "fulfilled",
      });
    }
  });
});
