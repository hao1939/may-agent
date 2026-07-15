import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildNotificationReplyText,
  buildTelegramReplyRoute,
  buildTelegramQuoteReplyText,
  extractProjectPath,
  normalizeProjectPath,
  readSessionReplyContext,
} from "./telegram-reply-router.js";

describe("telegram reply router helpers", () => {
  const root = "/home/hao/may-agent";

  it("normalizes shared and workspace project paths", () => {
    expect(normalizeProjectPath("/app/projects/demo/project.md", root)).toBe("projects/demo");
    expect(normalizeProjectPath("/app/agents/shared/projects/demo/project.md", root)).toBe("projects/demo");
    expect(normalizeProjectPath(`${root}/agents/scout/workspace/projects/learn/project.md`, root)).toBe(
      "agents/scout/workspace/projects/learn",
    );
    expect(normalizeProjectPath("shared/projects/demo", root)).toBe("projects/demo");
  });

  it("rejects non-project paths", () => {
    expect(normalizeProjectPath("agents/shared/not-project/demo", root)).toBeNull();
    expect(normalizeProjectPath("", root)).toBeNull();
    expect(normalizeProjectPath(null, root)).toBeNull();
  });

  it("extracts the first project path from message text", () => {
    expect(extractProjectPath("Please review projects/demo/project.md now", root)).toBe("projects/demo");
    expect(extractProjectPath("Please review agents/shared/projects/demo/project.md now", root)).toBe("projects/demo");
  });

  it("builds notification reply text from stored context and session context", () => {
    const text = buildNotificationReplyText({
      ctx: {
        event_type: "message.created",
        agent: "may",
        project_id: "projects/demo",
        data: JSON.stringify({ summary: "Needs review", text: "Original alert" }),
      },
      text: "Looks good",
      sessionContext: ["\nSession context (3 messages):", "  Last action: waiting"],
    });

    expect(text).toContain('[User replying to notification from may about project "projects/demo"]');
    expect(text).toContain("Human reply");
    expect(text).toContain("Looks good");
    expect(text).toContain("Situation: Needs review");
    expect(text).toContain("Visible notification: Original alert");
    expect(text).toContain("Session context (3 messages):");
    expect(text).toContain("Use the human reply as the decision or missing input");
  });

  it("keeps conversation metadata out of the notification reply text", () => {
    const ctx = {
      event_type: "message.created",
      agent: "may",
      project_id: "projects/aks-rp-e2e.app",
      data: JSON.stringify({
        text: "AKS RP E2E needs focus-plan approval",
        conversationId: "tg_focus_1",
        conversation: {
          originalIssue: {
            eventType: "project.focus.plan.requested",
            projectPath: "projects/aks-rp-e2e.app",
            planId: "focus-live-staging",
          },
          lastHandledBy: { agent: "may", sessionId: "s_may_1" },
        },
      }),
    };
    const text = buildNotificationReplyText({
      ctx,
      text: "approved, keep going",
    });
    const route = buildTelegramReplyRoute({
      text: "approved, keep going",
      replyToMsgId: 99,
      ctx,
      quotedText: "",
      projectRoot: root,
      persistDir: "/tmp/missing",
      interfaceAgent: "may",
    });

    expect(text).toContain("Human reply");
    expect(text).toContain("approved, keep going");
    expect(text).toContain("Visible notification: AKS RP E2E needs focus-plan approval");
    expect(text).toContain("System note");
    expect(text).not.toContain("Conversation: tg_focus_1");
    expect(text).not.toContain("Original issue:");
    expect(text).not.toContain("Last handled by:");
    expect(text).not.toContain("project.focus.plan.requested");
    expect(route.kind).toBe("notification");
    if (route.kind === "notification") {
      expect(route.context).toMatchObject({
        replyToMsgId: 99,
        conversationId: "tg_focus_1",
        projectId: "projects/aks-rp-e2e.app",
        originalIssue: {
          eventType: "project.focus.plan.requested",
          projectPath: "projects/aks-rp-e2e.app",
          planId: "focus-live-staging",
        },
      });
    }
  });

  it("keeps approval lineage fields out of the notification reply text", () => {
    const text = buildNotificationReplyText({
      ctx: {
        event_type: "message.created",
        agent: "aks-explorer",
        project_id: "projects/aks-rp-e2e.app",
        data: JSON.stringify({
          text: "AKS RP E2E approval packet dispatch",
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
          packetPath: "evidence/archive/example-approval.md",
          expectedResponse: {
            type: "project.approval.submitted",
            approvalId: "approval-123",
            waitId: "wait-123",
          },
        }),
      },
      text: "approve",
    });

    expect(text).toContain("Human reply");
    expect(text).toContain("approve");
    expect(text).toContain("Visible notification: AKS RP E2E approval packet dispatch");
    expect(text).not.toContain("Approval id:");
    expect(text).not.toContain("Wait id:");
    expect(text).not.toContain("Path id:");
    expect(text).not.toContain("Packet:");
    expect(text).not.toContain("Expected response:");
    expect(text).not.toContain("project.approval.submitted");
  });

  it("summarizes escalation and project-health context without dumping routing metadata", () => {
    const text = buildNotificationReplyText({
      ctx: {
        event_type: "message.created",
        agent: "evaluator",
        project_id: "projects/aks-rp-e2e.app",
        data: JSON.stringify({
          subject: "Project health review: aks-rp-e2e.app",
          kind: "project-health",
          severity: "P1",
          dedupKey: "aks:approval-return",
          targetProject: "aks-rp-e2e.app",
          reportPath: "reports/project-health/aks-rp-e2e.app/latest.md",
          verdict: "blocked-on-human",
          requestedHumanAction: "assign-owner",
          reason: "Approval return path is not visibly closing.",
          requestedAction: "Assign one owner to drain the approval return path.",
          conversationId: "project-health:aks-rp-e2e.app:aks:approval-return",
          originalIssue: {
            eventType: "evaluation.project.reviewed",
            targetProject: "aks-rp-e2e.app",
          },
          expectedClosure: ["project.owner.requested"],
          actionHints: ["accepted", "assign <owner>"],
          escalationId: "esc_1",
          sourceAgent: "evaluator",
          blockedOn: "owner decision",
        }),
      },
      text: "assign May and continue",
    });

    expect(text).toContain("Human reply");
    expect(text).toContain("assign May and continue");
    expect(text).toContain("Project: projects/aks-rp-e2e.app");
    expect(text).toContain(
      "Situation: Approval return path is not visibly closing.",
    );
    expect(text).toContain(
      "Original ask: Assign one owner to drain the approval return path.",
    );
    expect(text).toContain("System note");
    expect(text).not.toContain("Subject:");
    expect(text).not.toContain("Kind:");
    expect(text).not.toContain("Dedup key:");
    expect(text).not.toContain("Report:");
    expect(text).not.toContain("Expected closure:");
    expect(text).not.toContain("Action hints:");
    expect(text).not.toContain("Escalation id:");
    expect(text).not.toContain("Source agent:");
  });

  it("builds quote fallback reply text", () => {
    expect(buildTelegramQuoteReplyText("continue", "Previous message")).toBe(
      [
        "[User replying to Telegram message]",
        "Original Telegram message: Previous message",
        "",
        "User says: continue",
      ].join("\n"),
    );
  });

  it("reads compact session context for reply enrichment", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-reply-router-"));
    try {
      const sessionDir = join(persistDir, "sessions", "s_1");
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "session-compact.jsonl"),
        [
          JSON.stringify({ role: "system", content: [{ type: "text", text: "Compact summary of session" }] }),
          JSON.stringify({ role: "assistant", content: [{ type: "text", text: "Last assistant action" }] }),
        ].join("\n"),
      );

      expect(readSessionReplyContext(persistDir, "s_1")).toEqual([
        "\nSession context (2 messages):",
        "  Summary: Compact summary of session",
        "  Last action: Last assistant action",
      ]);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("builds a notification route with project and session context", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-reply-route-"));
    try {
      const sessionDir = join(persistDir, "sessions", "s_route");
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "session-compact.jsonl"),
        [
          JSON.stringify({ role: "system", content: [{ type: "text", text: "Route summary" }] }),
          JSON.stringify({ role: "assistant", content: [{ type: "text", text: "Route action" }] }),
        ].join("\n"),
      );

      const route = buildTelegramReplyRoute({
        text: "please continue",
        replyToMsgId: 42,
        ctx: {
          agent: "may",
          event_type: "message.created",
          session_id: "s_route",
          project_id: "projects/demo",
          data: JSON.stringify({ text: "Original" }),
        },
        quotedText: "",
        projectRoot: root,
        persistDir,
        interfaceAgent: "may",
      });

      expect(route.kind).toBe("notification");
      if (route.kind !== "notification") return;
      expect(route.owner).toBe("may");
      expect(route.projectPath).toBe("projects/demo");
      expect(route.sessionId).toBe("s_route");
      expect(route.enrichedText).toContain("Route summary");
      expect(route.enrichedText).toContain("Human reply");
      expect(route.enrichedText).toContain("please continue");
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("builds quote and missing-context routes without DB context", () => {
    expect(
      buildTelegramReplyRoute({
        text: "ok",
        replyToMsgId: 1,
        ctx: null,
        quotedText: "Prior message",
        projectRoot: root,
        persistDir: "/tmp/missing",
        interfaceAgent: "may",
      }),
    ).toMatchObject({ kind: "quote", enrichedText: buildTelegramQuoteReplyText("ok", "Prior message") });

    expect(
      buildTelegramReplyRoute({
        text: "ok",
        replyToMsgId: 2,
        ctx: null,
        quotedText: "",
        projectRoot: root,
        persistDir: "/tmp/missing",
        interfaceAgent: "may",
      }),
    ).toMatchObject({ kind: "missing-context" });
  });
});
