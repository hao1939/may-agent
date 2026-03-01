import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLearnTool } from "../src/tools.js";

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
});
