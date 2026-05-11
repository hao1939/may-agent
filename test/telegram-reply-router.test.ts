import { describe, expect, it } from "bun:test";
import {
  buildNotificationReplyText,
  buildTelegramQuoteReplyText,
  extractProjectPath,
  normalizeProjectPath,
} from "../src/app/ui/telegram-reply-router.js";

describe("telegram reply router helpers", () => {
  const root = "/home/example-user/may-agent";

  it("normalizes shared and workspace project paths", () => {
    expect(normalizeProjectPath("/app/agents/shared/projects/demo/project.md", root)).toBe("agents/shared/projects/demo");
    expect(normalizeProjectPath(`${root}/agents/scout/workspace/projects/learn/project.md`, root)).toBe("agents/scout/workspace/projects/learn");
    expect(normalizeProjectPath("shared/projects/demo", root)).toBe("agents/shared/projects/demo");
  });

  it("rejects non-project paths", () => {
    expect(normalizeProjectPath("agents/shared/not-project/demo", root)).toBeNull();
    expect(normalizeProjectPath("", root)).toBeNull();
    expect(normalizeProjectPath(null, root)).toBeNull();
  });

  it("extracts the first project path from message text", () => {
    expect(extractProjectPath("Please review agents/shared/projects/demo/project.md now", root)).toBe("agents/shared/projects/demo");
  });

  it("builds notification reply text from stored context and session context", () => {
    const text = buildNotificationReplyText({
      ctx: {
        event_type: "message.created",
        agent: "may",
        project_id: "agents/shared/projects/demo",
        data: JSON.stringify({ summary: "Needs review", text: "Original alert" }),
      },
      text: "Looks good",
      sessionContext: ["\nSession context (3 messages):", "  Last action: waiting"],
    });

    expect(text).toContain("[User replying to notification from may about project \"agents/shared/projects/demo\"]");
    expect(text).toContain("Context: Needs review");
    expect(text).toContain("Original notification: Original alert");
    expect(text).toContain("Session context (3 messages):");
    expect(text).toContain("User says: Looks good");
  });

  it("builds quote fallback reply text", () => {
    expect(buildTelegramQuoteReplyText("continue", "Previous message")).toBe([
      "[User replying to Telegram message]",
      "Original Telegram message: Previous message",
      "",
      "User says: continue",
    ].join("\n"));
  });
});
