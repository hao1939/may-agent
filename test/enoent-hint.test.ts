import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildEnoentHint, listDirEntries, createReadTool } from "../src/tools.js";

describe("listDirEntries", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "enoent-hint-list-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns files and directories with / suffix for dirs", () => {
    writeFileSync(join(testDir, "file.ts"), "content");
    mkdirSync(join(testDir, "subdir"));
    const entries = listDirEntries(testDir);
    expect(entries).toContain("subdir/");
    expect(entries).toContain("file.ts");
  });

  it("sorts directories before files", () => {
    writeFileSync(join(testDir, "z-file.ts"), "");
    mkdirSync(join(testDir, "a-dir"));
    writeFileSync(join(testDir, "a-file.ts"), "");
    mkdirSync(join(testDir, "z-dir"));

    const entries = listDirEntries(testDir);
    const dirIdx = entries.indexOf("a-dir/");
    const fileIdx = entries.indexOf("a-file.ts");
    expect(dirIdx).toBeLessThan(fileIdx);
  });

  it("returns empty array for empty directory", () => {
    const entries = listDirEntries(testDir);
    expect(entries).toEqual([]);
  });

  it("caps at 30 entries with overflow message", () => {
    for (let i = 0; i < 35; i++) {
      writeFileSync(join(testDir, `file-${String(i).padStart(3, "0")}.ts`), "");
    }
    const entries = listDirEntries(testDir);
    expect(entries).toHaveLength(31); // 30 entries + "... and 5 more"
    expect(entries[30]).toContain("... and 5 more");
  });
});

describe("buildEnoentHint", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "enoent-hint-"));
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "test"), { recursive: true });
    mkdirSync(join(projectRoot, ".state"), { recursive: true });
    writeFileSync(join(projectRoot, "package.json"), "{}");
    writeFileSync(join(projectRoot, "src", "tools.ts"), "content");
    writeFileSync(join(projectRoot, "src", "manager.ts"), "content");
    writeFileSync(join(projectRoot, "test", "tools.test.ts"), "content");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("includes the project root path", () => {
    const hint = buildEnoentHint(join(projectRoot, "nonexistent.ts"), projectRoot);
    expect(hint).toContain(`Project root: ${projectRoot}`);
  });

  it("shows relative path when file is under project root", () => {
    const hint = buildEnoentHint(join(projectRoot, "src", "missing.ts"), projectRoot);
    expect(hint).toContain("Requested (relative): src/missing.ts");
  });

  it("lists parent directory contents when parent exists", () => {
    const hint = buildEnoentHint(join(projectRoot, "src", "missing.ts"), projectRoot);
    // src/ directory exists, so should list its contents
    expect(hint).toContain("manager.ts");
    expect(hint).toContain("tools.ts");
  });

  it("shows top-level entries when parent doesn't exist", () => {
    const hint = buildEnoentHint(join(projectRoot, "nonexistent", "file.ts"), projectRoot);
    expect(hint).toContain("does not exist");
    expect(hint).toContain("Top-level entries:");
    expect(hint).toContain("src/");
    expect(hint).toContain("test/");
    expect(hint).toContain("package.json");
  });

  it("shows top-level entries when path is outside project root", () => {
    const hint = buildEnoentHint("/some/random/path.ts", projectRoot);
    expect(hint).toContain("Top-level entries:");
    expect(hint).toContain("src/");
  });

  it("lists top-level project root when missing file is directly in root", () => {
    const hint = buildEnoentHint(join(projectRoot, "CLAUDE.md"), projectRoot);
    // Parent dir is projectRoot itself, which exists
    expect(hint).toContain("(project root)");
    expect(hint).toContain("src/");
    expect(hint).toContain("test/");
    expect(hint).toContain("package.json");
  });

  it("does not show relative path for files outside project root", () => {
    const hint = buildEnoentHint("/etc/missing-config.yaml", projectRoot);
    expect(hint).not.toContain("Requested (relative):");
  });
});

describe("read tool ENOENT integration", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "enoent-read-"));
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "test"), { recursive: true });
    writeFileSync(join(projectRoot, "package.json"), "{}");
    writeFileSync(join(projectRoot, "src", "tools.ts"), "// tools");
    writeFileSync(join(projectRoot, "src", "manager.ts"), "// manager");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("includes project root in ENOENT error", async () => {
    const tool = createReadTool({ projectRoot });
    const result = await tool.execute("id", { path: join(projectRoot, "missing.ts") });
    const text = result.content[0].text;
    expect(text).toContain("ENOENT");
    expect(text).toContain(`Project root: ${projectRoot}`);
  });

  it("lists sibling files when parent directory exists", async () => {
    const tool = createReadTool({ projectRoot });
    const result = await tool.execute("id", { path: join(projectRoot, "src", "nonexistent.ts") });
    const text = result.content[0].text;
    expect(text).toContain("tools.ts");
    expect(text).toContain("manager.ts");
  });

  it("lists top-level entries when parent directory does not exist", async () => {
    const tool = createReadTool({ projectRoot });
    const result = await tool.execute("id", { path: join(projectRoot, "lib", "something.ts") });
    const text = result.content[0].text;
    expect(text).toContain("does not exist");
    expect(text).toContain("Top-level entries:");
    expect(text).toContain("src/");
    expect(text).toContain("test/");
  });

  it("shows relative path in the hint", async () => {
    const tool = createReadTool({ projectRoot });
    const result = await tool.execute("id", { path: join(projectRoot, "src", "missing.ts") });
    const text = result.content[0].text;
    expect(text).toContain("Requested (relative): src/missing.ts");
  });

  it("handles hallucinated path ENOENT with directory listing", async () => {
    const tool = createReadTool({ projectRoot });
    // Hallucinated path gets rewritten to projectRoot/src/nonexistent.ts
    const result = await tool.execute("id", { path: "/home/user/repo/src/nonexistent.ts" });
    const text = result.content[0].text;
    expect(text).toContain("ENOENT");
    expect(text).toContain("tools.ts");
    expect(text).toContain("manager.ts");
  });

  it("handles relative path ENOENT with directory listing", async () => {
    const tool = createReadTool({ projectRoot });
    const result = await tool.execute("id", { path: "src/nonexistent.ts" });
    const text = result.content[0].text;
    expect(text).toContain("ENOENT");
    expect(text).toContain("tools.ts");
    expect(text).toContain("manager.ts");
  });

  it("does not include hint without projectRoot option", async () => {
    const tool = createReadTool();
    const result = await tool.execute("id", { path: "/definitely/nonexistent/path.ts" });
    const text = result.content[0].text;
    expect(text).toContain("ENOENT");
    expect(text).not.toContain("Project root:");
  });
});
