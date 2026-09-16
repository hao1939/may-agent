import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import type { ConversationTurnResult } from "@may-agent/sdk";
import may from "../../app";
import scout from "../../../scout-knowledge-lib.app/app";

const host = process.env.MAY_HOST_SOURCE;

test.skipIf(!host)(
  "correction during a claimed Scout attempt prevents obsolete completion and survives reopen",
  async () => {
    const load = (path: string) =>
      import(pathToFileURL(join(host!, path)).href);
    const { getDb, closeDb } = await load("src/lib/requests.ts");
    const { AppTaskResourceStore } = await load(
      "src/app/core/state/app-task-resource-store.ts",
    );
    const { appTaskContext, claimObservedAppTask, completeAppTask } =
      await load("src/app/core/tasks/app-task-reconciler.ts");
    const {
      admitConversationTaskInput,
      conversationTaskIntent,
      completeConversationTaskTurn,
    } = await load("src/app/core/state/conversation-task-turns.ts");
    const { prepareConversationTaskTurn } = await load(
      "src/app/composition/conversation-task-turn.ts",
    );
    const { readConversationRequest, applyConversationRequestUpdates } =
      await load("src/app/core/state/conversation-requests.ts");
    const root = mkdtempSync(join(tmpdir(), "may-running-correction-"));
    let db = getDb(root);
    const scoutFixture = {
      ...scout,
      task(admitted: Parameters<NonNullable<typeof scout.task>>[0]) {
        const attachment = scout.task!(admitted);
        if (attachment.kind === "desired")
          attachment.intent.outputs = [join(root, "knowledge")];
        return attachment;
      },
    };
    const context = (appId: string) =>
      appTaskContext({
        appDir: join(root, appId),
        projectDir: root,
        agent: appId === "may" ? "may" : "scout",
        resourceStore: AppTaskResourceStore.fromDb(db, appId),
      });
    for (const app of [may, scout])
      context(app.id).resourceStore.bootstrapSnapshot(
        {
          project: app.id,
          root_task_id: "root",
          project_lifecycle: "active",
          groups: {
            root: { id: "root", parent_id: null },
            "library-operations": {
              id: "library-operations",
              parent_id: "root",
            },
          },
        },
        "poc-fixture",
      );
    async function turn(id: string, decision: ConversationTurnResult) {
      const config = context("may");
      const admitted = admitConversationTaskInput(config, {
        id,
        appId: "may",
        conversationId: "research",
        conversationSequence: Date.now(),
        source: { kind: "human", id },
        input: {
          kind: "message",
          data: { message: decision.requestUpdates![0].scope },
        },
        intent: conversationTaskIntent(config),
      });
      const claim = claimObservedAppTask(config, {
        taskId: admitted.taskId,
        appAgent: "may",
        handler: "executor:conversation",
      });
      expect(claim.kind).toBe("claimed");
      const prepared = await prepareConversationTaskTurn({
        config,
        claim,
        app: may,
        resolveConversationInput: async () => decision,
        getTaskApp: (appId: string) => ({
          app: scoutFixture,
          config: context(appId),
        }),
        signal: new AbortController().signal,
      });
      return completeConversationTaskTurn(
        config,
        claim,
        prepared.decision,
        prepared,
      );
    }
    try {
      const initial: ConversationTurnResult = {
        summary: "Research accepted",
        response: "Scout will read and archive the paper.",
        topic: { kind: "new", title: "Paper assessment" },
        requestUpdates: [
          {
            id: "paper",
            expectedRevision: 0,
            scope: "Read and archive the paper",
            disposition: "open",
          },
        ],
        followUp: {
          requestId: "paper",
          appId: scout.id,
          outcome: "Read and archive the paper",
          acceptance: ["Archived assessment"],
          input: {
            kind: "goal",
            data: {
              outcome: "Read and archive the paper",
              acceptance: ["Archived assessment"],
            },
          },
        },
      };
      const first = await turn("link", initial);
      const taskId = first.admittedTasks[0].taskId;
      const oldClaim = claimObservedAppTask(context(scout.id), {
        taskId,
        appAgent: "scout",
        handler: "agent:scout",
      });
      expect(oldClaim.kind).toBe("claimed");
      const request = readConversationRequest(db, "may", "research", "paper");
      const updated =
        "Read and archive the paper; focus on whether the experiments support its conclusion";
      const corrected = await turn("correction", {
        ...initial,
        response: "I will focus the existing research on experimental support.",
        topic: { kind: "existing", id: request.topicId },
        requestUpdates: [
          {
            id: "paper",
            expectedRevision: request.revision,
            scope: updated,
            disposition: "open",
          },
        ],
        followUp: {
          ...initial.followUp!,
          task: { appId: scout.id, taskId },
          outcome: updated,
          input: {
            kind: "goal",
            data: {
              outcome: updated,
              acceptance: [
                "Archived assessment",
                "Evaluate experimental support",
              ],
            },
          },
        },
      });
      expect(corrected.admittedTasks[0].taskId).toBe(taskId);
      const obsolete = completeAppTask(context(scout.id), oldClaim, {
        summary: "Old assessment without experimental analysis",
        facts: ["Synthetic obsolete worker result"],
      });
      expect(obsolete.taskContinues).toBe(true);
      expect(
        context(scout.id).resourceStore.readAttempt(oldClaim.attemptId)
          ?.acceptedResult,
      ).toBeUndefined();
      expect(
        readConversationRequest(db, "may", "research", "paper").status,
      ).toBe("open");
      closeDb(root);
      db = getDb(root);
      const fresh = claimObservedAppTask(context(scout.id), {
        taskId,
        appAgent: "scout",
        handler: "agent:scout",
      });
      expect(fresh.kind).toBe("claimed");
      expect(JSON.stringify(fresh.events)).toContain(
        "Evaluate experimental support",
      );
      expect(
        readConversationRequest(db, "may", "research", "paper").scope,
      ).toBe(updated);
      expect(() =>
        applyConversationRequestUpdates(db, {
          appId: "may",
          conversationId: "research",
          updateKey: "obsolete-closure",
          messageId: "old-answer",
          now: Date.now(),
          updates: [
            {
              id: "paper",
              expectedRevision: request.revision,
              scope: request.scope,
              disposition: "fulfilled",
              reason: "Old scope complete",
            },
          ],
        }),
      ).toThrow();
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  },
);
