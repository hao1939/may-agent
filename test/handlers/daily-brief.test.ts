/**
 * Tests for collectDailyBrief() from daily-brief handler.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { collectDailyBrief } from "../../agents/may/handlers/daily-brief.js";

describe("collectDailyBrief", () => {
  let dir: string;
  let persistDir: string;
  let agentsRoot: string;
  let projectRoot: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "daily-brief-"));
    persistDir = resolve(dir, ".state");
    agentsRoot = resolve(dir, "agents");
    projectRoot = dir;
    mkdirSync(resolve(persistDir, "sessions"), { recursive: true });
    mkdirSync(resolve(persistDir, "evaluations"), { recursive: true });
    mkdirSync(resolve(agentsRoot, "may", "workspace"), { recursive: true });
    mkdirSync(resolve(agentsRoot, "bob", "workspace"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("produces a formatted brief with empty state", () => {
    const brief = collectDailyBrief({ persistDir, agentsRoot, projectRoot });

    expect(brief).toContain("Daily Brief");
    expect(brief).toContain("Sessions:");
    expect(brief).toContain("Commits:");
    expect(brief).toContain("Evaluations:");
    expect(brief).toContain("Top Issue");
  });

  it("counts cron jobs from may/cron.json", () => {
    mkdirSync(resolve(agentsRoot, "may"), { recursive: true });
    writeFileSync(resolve(agentsRoot, "may", "cron.json"), JSON.stringify([
      { name: "a", intervalMs: 60000, message: "a" },
      { name: "b", intervalMs: 60000, message: "b" },
    ]));

    const brief = collectDailyBrief({ persistDir, agentsRoot, projectRoot });
    expect(brief).toContain("Cron jobs: 2");
  });

  it("reports agent backlogs from todo.md", () => {
    writeFileSync(resolve(agentsRoot, "bob", "workspace", "todo.md"), `# TODO

- [ ] Fix performance issue
- [ ] Write docs
- [x] Already done
`);

    const brief = collectDailyBrief({ persistDir, agentsRoot, projectRoot });
    expect(brief).toContain("bob: 2 pending");
  });

  it("reads top issue from bob analysis.md", () => {
    writeFileSync(resolve(agentsRoot, "bob", "workspace", "analysis.md"), `## Executive Summary

Tool call efficiency remains the primary bottleneck.

## Top Findings
`);

    const brief = collectDailyBrief({ persistDir, agentsRoot, projectRoot });
    expect(brief).toContain("Tool call efficiency");
  });

  it("handles missing analysis.md gracefully", () => {
    // Don't create analysis.md
    const brief = collectDailyBrief({ persistDir, agentsRoot, projectRoot });
    expect(brief).toContain("No analysis available");
  });
});
