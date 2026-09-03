import { describe, expect, it } from "bun:test";
import { inspectRelativeLinks } from "./scout-relative-links";

describe("Scout durable-document relative links", () => {
  it("checks local targets while skipping anchors and network links", () => {
    const existing = new Set(["/library/knowledge/finding.md"]);
    const result = inspectRelativeLinks(
      [
        {
          path: "/library/knowledge/topic.md",
          contents:
            "[finding](finding.md#evidence) [web](https://example.com/x) " +
            "[mail](mailto:a@example.com) [section](#next)",
        },
      ],
      (path) => existing.has(path),
    );

    expect(result).toEqual({ ok: true, checked: 1, errors: [] });
  });

  it("decodes angle-wrapped local paths and reports missing targets", () => {
    const existing = new Set(["/library/report/a note.md"]);
    const result = inspectRelativeLinks(
      [
        {
          path: "/library/report/index.md",
          contents: "[present](<a%20note.md>) [missing](gone.md)",
        },
      ],
      (path) => existing.has(path),
    );

    expect(result).toEqual({
      ok: false,
      checked: 2,
      errors: ["/library/report/index.md: missing relative link gone.md"],
    });
  });

  it("rejects local absolute paths instead of publishing them as links", () => {
    expect(
      inspectRelativeLinks(
        [{ path: "/library/index.md", contents: "[local](/private/file.md)" }],
        () => true,
      ),
    ).toEqual({
      ok: false,
      checked: 1,
      errors: ["/library/index.md: absolute local link /private/file.md"],
    });
  });
});
