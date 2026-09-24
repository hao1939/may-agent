import { describe, expect, it } from "bun:test";
import { parseXhsSearchOutput } from "./xhs-source";

describe("XHS search source parsing", () => {
  it("keeps only current items with stable identity, title, and link", () => {
    const result = parseXhsSearchOutput(
      "AI agent 智能体",
      JSON.stringify({
        status: "success",
        data: [
          {
            id: "note-1",
            title: "Agent workflow",
            author: "author",
            likes: "12",
            link: "https://www.xiaohongshu.com/explore/note-1?xsec_token=test",
          },
          { id: "missing-link", title: "not admissible" },
        ],
      }),
    );

    expect(result).toMatchObject({
      state: "success",
      query: "AI agent 智能体",
      items: [{ id: "note-1", title: "Agent workflow" }],
      evidence: [
        "source:xhs",
        "query:AI agent 智能体",
        "items:1",
        "source-ids:note-1",
        "discarded-items:1",
        "observation:partial",
      ],
    });
  });

  it("distinguishes genuinely empty, wholly unusable and malformed results", () => {
    expect(
      parseXhsSearchOutput(
        "query",
        JSON.stringify({ status: "success", data: [] }),
      ),
    ).toMatchObject({ state: "success", items: [] });
    for (const data of [
      [null],
      [{ id: "x" }],
      [{ id: {}, title: [], link: 42 }],
    ]) {
      expect(
        parseXhsSearchOutput(
          "query",
          JSON.stringify({ status: "success", data }),
        ),
      ).toMatchObject({
        state: "failed",
        evidence: expect.arrayContaining(["discarded-items:1"]),
      });
    }
    expect(parseXhsSearchOutput("query", "null")).toMatchObject({
      state: "failed",
    });
  });

  it("reports invalid or failed current tool output exactly", () => {
    expect(parseXhsSearchOutput("query", "not-json", "", 1)).toMatchObject({
      state: "failed",
      reason: "XHS search returned invalid JSON",
      evidence: ["exit:1", "output:invalid-json"],
    });
    expect(
      parseXhsSearchOutput(
        "query",
        JSON.stringify({ status: "error", error: "search timeout" }),
        "",
        1,
      ),
    ).toMatchObject({
      state: "failed",
      reason: "search timeout",
      evidence: ["exit:1"],
    });
  });
});
