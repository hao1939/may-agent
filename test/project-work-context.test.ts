import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseProjectMeta } from "../shared/lib/project-health.ts";

const PROJECTS_DIR = join(process.cwd(), "projects");
const TERMINAL_STATUSES = new Set(["closed", "complete", "done"]);

function activeProjectFiles(): string[] {
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "may-agent")
    .map((entry) => join(PROJECTS_DIR, entry.name, "project.md"))
    .filter((path) => existsSync(path))
    .filter((path) => {
      const content = readFileSync(path, "utf-8");
      const status = parseProjectMeta(content).status ?? "active";
      return !TERMINAL_STATUSES.has(status);
    });
}

describe("project work-context convention", () => {
  it("non-terminal shared projects expose goal, signals, state, plan, validation, and journal", () => {
    const files = activeProjectFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content, file).toMatch(/^## Goal\b/m);
      expect(content, file).toMatch(/^## Signals?\b/m);
      expect(content, file).toMatch(/^## Current State\b/m);
      expect(content, file).toMatch(/^## (Proposed )?Plan\b/m);
      expect(content, file).toMatch(/^## (Validation|Acceptance Criteria)\b/m);
      expect(content, file).toMatch(/^## (Journal|Comments)\b/m);
    }
  });
});
