import { describe, expect, it } from "bun:test";
import { buildExploreTask } from "./scout-explore";

describe("scout-explore workflow prompt", () => {
  it("adds an explicit output contract to routine discovery tasks", () => {
    const task = buildExploreTask("Explore Hacker News for AI agent discussions.");

    expect(task).toContain("Explore Hacker News for AI agent discussions.");
    expect(task).toContain("projects/scout-knowledge-lib/knowledge/");
    expect(task).toContain("projects/scout-knowledge-lib/knowledge/findings/");
    expect(task).toContain("agents/scout/workspace/findings/");
    expect(task).toContain("Never create new top-level folders under `projects/`");
    expect(task).toContain("do not write paths like `projects/explore/...`");
  });
});
