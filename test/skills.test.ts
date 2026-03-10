import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseFrontmatter, loadSkillsFromDirs, formatSkillsForPrompt } from "../src/lib/skills.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parseFrontmatter", () => {
  it("parses basic frontmatter", () => {
    const content = `---
name: brave-search
description: Web search via Brave API
---

# Content here
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("brave-search");
    expect(fm.description).toBe("Web search via Brave API");
  });

  it("returns empty object when no frontmatter", () => {
    const content = "# Just a heading\n\nSome content.";
    expect(parseFrontmatter(content)).toEqual({});
  });

  it("returns empty object for unclosed frontmatter", () => {
    const content = "---\nname: test\nno closing fence";
    expect(parseFrontmatter(content)).toEqual({});
  });

  it("strips surrounding quotes from values", () => {
    const content = `---
name: "quoted-name"
description: 'single quoted'
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("quoted-name");
    expect(fm.description).toBe("single quoted");
  });

  it("handles extra keys", () => {
    const content = `---
name: foo
description: bar
version: 1.0
author: someone
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("foo");
    expect(fm.description).toBe("bar");
    expect(fm.version).toBe("1.0");
    expect(fm.author).toBe("someone");
  });

  it("handles values with colons", () => {
    const content = `---
name: my-skill
description: Use for searching: docs, facts, or web content.
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.description).toBe("Use for searching: docs, facts, or web content.");
  });

  it("ignores comment lines and blank lines", () => {
    const content = `---
name: test
# this is a comment
description: hello

---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("test");
    expect(fm.description).toBe("hello");
  });

  it("handles leading whitespace before frontmatter", () => {
    const content = `  \n---
name: indented
description: works
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("indented");
    expect(fm.description).toBe("works");
  });
});

describe("loadSkillsFromDirs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skills-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads direct .md files from root", () => {
    writeFileSync(
      join(tmpDir, "search.md"),
      `---
name: search
description: Search the web
---
# Search instructions
`,
    );

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("search");
    expect(skills[0].description).toBe("Search the web");
    expect(skills[0].filePath).toBe(join(tmpDir, "search.md"));
  });

  it("loads SKILL.md from subdirectories", () => {
    const subdir = join(tmpDir, "brave-search");
    mkdirSync(subdir);
    writeFileSync(
      join(subdir, "SKILL.md"),
      `---
name: brave-search
description: Brave Search API
---
# Brave Search
`,
    );

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("brave-search");
    expect(skills[0].filePath).toBe(join(subdir, "SKILL.md"));
  });

  it("loads SKILL.md from nested subdirectories", () => {
    const nested = join(tmpDir, "category", "deep-skill");
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(nested, "SKILL.md"),
      `---
name: deep
description: A deeply nested skill
---
`,
    );

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("deep");
  });

  it("skips entries with no description", () => {
    writeFileSync(
      join(tmpDir, "no-desc.md"),
      `---
name: incomplete
---
# No description
`,
    );

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(0);
  });

  it("skips .md files without frontmatter", () => {
    writeFileSync(join(tmpDir, "plain.md"), "# Just a plain file\n");
    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(0);
  });

  it("uses filename as name when frontmatter has no name", () => {
    writeFileSync(
      join(tmpDir, "auto-named.md"),
      `---
description: Should use filename as name
---
`,
    );

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("auto-named");
  });

  it("scans multiple directories", () => {
    const dir1 = join(tmpDir, "dir1");
    const dir2 = join(tmpDir, "dir2");
    mkdirSync(dir1);
    mkdirSync(dir2);

    writeFileSync(join(dir1, "a.md"), "---\nname: a\ndescription: Skill A\n---\n");
    writeFileSync(join(dir2, "b.md"), "---\nname: b\ndescription: Skill B\n---\n");

    const skills = loadSkillsFromDirs([dir1, dir2]);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(["a", "b"]);
  });

  it("skips nonexistent directories gracefully", () => {
    const skills = loadSkillsFromDirs(["/nonexistent/path/xyz"]);
    expect(skills).toHaveLength(0);
  });

  it("ignores non-.md files in root", () => {
    writeFileSync(join(tmpDir, "script.js"), "console.log('hi')");
    writeFileSync(join(tmpDir, "README.txt"), "readme");
    writeFileSync(join(tmpDir, "skill.md"), "---\nname: real\ndescription: Real skill\n---\n");

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("real");
  });

  it("only picks up SKILL.md (not other .md) from subdirectories", () => {
    const subdir = join(tmpDir, "my-skill");
    mkdirSync(subdir);
    writeFileSync(join(subdir, "SKILL.md"), "---\nname: my-skill\ndescription: The skill\n---\n");
    writeFileSync(join(subdir, "README.md"), "---\nname: readme\ndescription: Not a skill\n---\n");

    const skills = loadSkillsFromDirs([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-skill");
  });
});

describe("formatSkillsForPrompt", () => {
  it("formats skills as XML block", () => {
    const skills = [
      { name: "brave-search", description: "Web search via Brave API", filePath: "/path/to/SKILL.md" },
      { name: "pdf-tools", description: "Extract text from PDFs", filePath: "/other/path/SKILL.md" },
    ];

    const output = formatSkillsForPrompt(skills);

    expect(output).toContain("<available_skills>");
    expect(output).toContain("</available_skills>");
    expect(output).toContain("<name>brave-search</name>");
    expect(output).toContain("<description>Web search via Brave API</description>");
    expect(output).toContain("<location>/path/to/SKILL.md</location>");
    expect(output).toContain("<name>pdf-tools</name>");
    expect(output).toContain("<description>Extract text from PDFs</description>");
    expect(output).toContain("<location>/other/path/SKILL.md</location>");
  });

  it("returns empty string for empty skills array", () => {
    expect(formatSkillsForPrompt([])).toBe("");
  });

  it("escapes XML special characters", () => {
    const skills = [
      { name: "test&skill", description: 'Has <special> "chars"', filePath: "/path/to/file.md" },
    ];

    const output = formatSkillsForPrompt(skills);
    expect(output).toContain("<name>test&amp;skill</name>");
    expect(output).toContain("<description>Has &lt;special&gt; &quot;chars&quot;</description>");
  });

  it("produces valid structure for single skill", () => {
    const skills = [
      { name: "solo", description: "Only one", filePath: "/solo/SKILL.md" },
    ];

    const expected = `<available_skills>
  <skill>
    <name>solo</name>
    <description>Only one</description>
    <location>/solo/SKILL.md</location>
  </skill>
</available_skills>`;

    expect(formatSkillsForPrompt(skills)).toBe(expected);
  });
});
