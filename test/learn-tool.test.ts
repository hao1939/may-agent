import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLearnTool } from "../src/lib/tools/learn.js";

describe("createLearnTool()", () => {
  let knowledgeDir: string;

  beforeEach(() => {
    knowledgeDir = mkdtempSync(join(tmpdir(), "may-learn-"));
  });

  afterEach(() => {
    if (existsSync(knowledgeDir)) {
      rmSync(knowledgeDir, { recursive: true, force: true });
    }
  });

  it("has the correct tool metadata", () => {
    const tool = createLearnTool(knowledgeDir);
    expect(tool.name).toBe("learn");
    expect(tool.label).toBe("Learn");
    expect(tool.description).toContain("Record a lesson");
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe("function");
  });

  it("creates lessons.md with header when it does not exist", async () => {
    const tool = createLearnTool(knowledgeDir);
    const lessonsPath = join(knowledgeDir, "lessons.md");

    expect(existsSync(lessonsPath)).toBe(false);

    const result = await tool.execute("tc1", { lesson: "Always check file existence before reading." });

    expect(result.content[0].text).toBe("Lesson recorded.");
    expect(existsSync(lessonsPath)).toBe(true);

    const content = readFileSync(lessonsPath, "utf-8");
    expect(content).toContain("# Lessons");
    expect(content).toContain("Always check file existence before reading.");
  });

  it("appends to existing lessons.md", async () => {
    const tool = createLearnTool(knowledgeDir);

    // First lesson creates the file
    await tool.execute("tc1", { lesson: "First lesson." });

    // Second lesson appends
    await tool.execute("tc2", { lesson: "Second lesson." });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("First lesson.");
    expect(content).toContain("Second lesson.");
  });

  it("includes a timestamp in each entry", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Timestamped lesson." });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    // Timestamp format: YYYY-MM-DD HH:MM
    expect(content).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it("formats each entry as a list item with timestamp prefix", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "My lesson text." });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    // Should have "- YYYY-MM-DD HH:MM: My lesson text."
    expect(content).toMatch(/- \d{4}-\d{2}-\d{2} \d{2}:\d{2}: My lesson text\./);
  });

  it("creates parent directories if knowledgeDir doesn't exist", async () => {
    const nestedDir = join(knowledgeDir, "nested", "deep", "knowledge");
    rmSync(knowledgeDir, { recursive: true, force: true });

    const tool = createLearnTool(nestedDir);
    const result = await tool.execute("tc1", { lesson: "Nested lesson." });

    expect(result.content[0].text).toBe("Lesson recorded.");
    expect(existsSync(join(nestedDir, "lessons.md"))).toBe(true);
  });

  it("handles multiple rapid appends correctly", async () => {
    const tool = createLearnTool(knowledgeDir);

    // Fire several learns rapidly
    await Promise.all([
      tool.execute("tc1", { lesson: "Lesson A" }),
      tool.execute("tc2", { lesson: "Lesson B" }),
      tool.execute("tc3", { lesson: "Lesson C" }),
    ]);

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("Lesson A");
    expect(content).toContain("Lesson B");
    expect(content).toContain("Lesson C");
  });

  // ── Category tests ─────────────────────────────────────────────────

  it("defaults to 'general' category when no category provided", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "A general lesson." });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("## general");
    expect(content).toContain("A general lesson.");
  });

  it("places lessons under the specified category", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Use vitest for testing.", category: "testing" });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("## testing");
    expect(content).toContain("Use vitest for testing.");
  });

  it("supports multiple categories in the same file", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "First test lesson.", category: "testing" });
    await tool.execute("tc2", { lesson: "Architecture insight.", category: "architecture" });
    await tool.execute("tc3", { lesson: "General advice." });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("## testing");
    expect(content).toContain("## architecture");
    expect(content).toContain("## general");
    expect(content).toContain("First test lesson.");
    expect(content).toContain("Architecture insight.");
    expect(content).toContain("General advice.");
  });

  it("normalizes category to lowercase", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Lesson one.", category: "Testing" });
    await tool.execute("tc2", { lesson: "Lesson two.", category: "TESTING" });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    // Both should be under "testing" (lowercase), not duplicated headers
    const headerCount = (content.match(/## testing/g) || []).length;
    expect(headerCount).toBe(1);
    expect(content).toContain("Lesson one.");
    expect(content).toContain("Lesson two.");
  });

  it("groups lessons under the same category header", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Debug tip 1.", category: "debugging" });
    await tool.execute("tc2", { lesson: "Debug tip 2.", category: "debugging" });

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    // Only one ## debugging header
    const headerCount = (content.match(/## debugging/g) || []).length;
    expect(headerCount).toBe(1);
    expect(content).toContain("Debug tip 1.");
    expect(content).toContain("Debug tip 2.");
  });

  // ── Deduplication tests ────────────────────────────────────────────

  it("skips exact duplicate lessons", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Always run tests." });
    const result = await tool.execute("tc2", { lesson: "Always run tests." });

    expect(result.content[0].text).toBe("Lesson already exists (duplicate skipped).");

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    const count = (content.match(/Always run tests\./g) || []).length;
    expect(count).toBe(1);
  });

  it("detects duplicates case-insensitively", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Check types before commit." });
    const result = await tool.execute("tc2", { lesson: "check types before commit." });

    expect(result.content[0].text).toBe("Lesson already exists (duplicate skipped).");
  });

  it("detects substring duplicates (new is substring of existing)", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Always run tsc and vitest before committing." });
    const result = await tool.execute("tc2", { lesson: "run tsc and vitest" });

    expect(result.content[0].text).toBe("Lesson already exists (duplicate skipped).");
  });

  it("detects substring duplicates (existing is substring of new)", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "run tests" });
    const result = await tool.execute("tc2", { lesson: "Always run tests before pushing code." });

    expect(result.content[0].text).toBe("Lesson already exists (duplicate skipped).");
  });

  it("detects duplicates across categories", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Use strict mode.", category: "typescript" });
    const result = await tool.execute("tc2", { lesson: "Use strict mode.", category: "general" });

    expect(result.content[0].text).toBe("Lesson already exists (duplicate skipped).");
  });

  it("allows distinct lessons that are not substrings of each other", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Use vitest for tests." });
    const result = await tool.execute("tc2", { lesson: "Use eslint for linting." });

    expect(result.content[0].text).toBe("Lesson recorded.");

    const content = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
    expect(content).toContain("Use vitest for tests.");
    expect(content).toContain("Use eslint for linting.");
  });

  // ── listLessons tests ─────────────────────────────────────────────

  it("returns 'no lessons' when listLessons is true and no file exists", async () => {
    const tool = createLearnTool(knowledgeDir);
    const result = await tool.execute("tc1", { listLessons: true });

    expect(result.content[0].text).toBe("No lessons recorded yet.");
  });

  it("returns current lessons when listLessons is true", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Lesson alpha.", category: "testing" });
    await tool.execute("tc2", { lesson: "Lesson beta.", category: "architecture" });

    const result = await tool.execute("tc3", { listLessons: true });
    const text = result.content[0].text;

    expect(text).toContain("# Lessons");
    expect(text).toContain("## testing");
    expect(text).toContain("## architecture");
    expect(text).toContain("Lesson alpha.");
    expect(text).toContain("Lesson beta.");
  });

  it("ignores lesson param when listLessons is true", async () => {
    const tool = createLearnTool(knowledgeDir);
    await tool.execute("tc1", { lesson: "Existing lesson." });

    // Call with listLessons=true and a lesson — should list, not add
    const result = await tool.execute("tc2", { lesson: "Should not be added.", listLessons: true });
    const text = result.content[0].text;

    expect(text).toContain("Existing lesson.");
    expect(text).not.toContain("Should not be added.");
  });

  // ── Error handling ─────────────────────────────────────────────────

  it("returns error when lesson param is missing in add mode", async () => {
    const tool = createLearnTool(knowledgeDir);
    const result = await tool.execute("tc1", {});

    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("'lesson' parameter is required");
  });
});
