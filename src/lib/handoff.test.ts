import { describe, expect, it } from "vitest";
import { summarizeForHandoff } from "./handoff.js";
import type { TaskResult } from "./types.js";

describe("summarizeForHandoff", () => {
  it("shows structured finish status when present", () => {
    const result: TaskResult = {
      sessionId: "s1",
      status: "done",
      lastAssistantText: "blocked on external deploy",
      messages: [],
      duration: "1s",
      outputDir: "/tmp/out",
      finishResult: { status: "blocked", summary: "blocked on external deploy" },
    };

    expect(summarizeForHandoff(result)).toContain("**Status:** done / finish(blocked) (1s)");
  });
});
