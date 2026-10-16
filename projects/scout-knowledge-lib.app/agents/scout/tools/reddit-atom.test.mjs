import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "reddit-atom-"));
  roots.push(root);
  const path = join(root, "source.atom");
  writeFileSync(
    path,
    `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>t3_one</id><title> First   item </title><updated>2026-10-16T20:00:00Z</updated><link href="https://www.reddit.com/r/test/comments/one"/><content type="html">&lt;p&gt;First body with &lt;b&gt;evidence&lt;/b&gt; and literal &amp;lt;tool_call&amp;gt; code.&lt;/p&gt;</content></entry>
  <entry><id>t3_two</id><title>Second item</title><updated>2026-10-16T20:01:00Z</updated><link href="https://www.reddit.com/r/test/comments/two"/><content type="html">&lt;p&gt;Second body.&lt;/p&gt;</content></entry>
</feed>`,
  );
  return path;
}

function run(...args) {
  return Bun.spawnSync([
    "python3",
    new URL("./reddit-atom.py", import.meta.url).pathname,
    ...args,
  ]);
}

describe("bounded Reddit Atom evidence", () => {
  test("indexes saved raw evidence without returning entry bodies", () => {
    const path = fixture();
    const result = run("inspect", "--raw", path);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toMatchObject({
      rawEvidence: path,
      entryCount: 2,
      coverage: { returnedEntries: 2, totalEntries: 2, detailIncluded: false },
      entries: [
        { id: "t3_one", title: "First item", contentChars: 74 },
        { id: "t3_two", title: "Second item" },
      ],
    });
    expect(parsed.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.stdout.toString()).not.toContain("First body");
  });

  test("returns only the selected stable entry with explicit coverage", () => {
    const path = fixture();
    const result = run("inspect", "--raw", path, "--id", "t3_one");
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toMatchObject({
      entryCount: 2,
      coverage: { selectedId: "t3_one", truncated: false },
      entry: {
        id: "t3_one",
        title: "First item",
        contentText:
          "First body with\nevidence\nand literal <tool_call> code.",
      },
    });
    expect(parsed.entry).not.toHaveProperty("content");
    expect(result.stdout.toString()).not.toContain("Second body");
  });

  test("rejects an unknown stable id without dumping raw source", () => {
    const path = fixture();
    const result = run("inspect", "--raw", path, "--id", "t3_missing");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Atom entry not found: t3_missing");
    expect(result.stderr.toString()).not.toContain("First body");
  });
});
