/**
 * Tests for the lessons module — Phase 1 of agent learning implementation.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractLessons, retrieveLessons, decayLessons } from "../src/lib/lessons.ts";

describe("lessons module", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "lessons-test-"));
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  describe("extractLessons", () => {
    it("extracts explicit lessons from finish output", () => {
      const result = extractLessons(agentsRoot, "worker", "fix the build", {
        status: "success",
        summary: "Fixed the build",
        lessons: [
          { category: "fix", content: "Always run npm install before build" },
          { category: "pattern", content: "Check package-lock.json for conflicts" },
        ],
      });

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].category, "fix");
      assert.strictEqual(result[0].text, "Always run npm install before build");
      assert.strictEqual(result[0].agent, "worker");
      assert.strictEqual(result[0].confidence, 1.0);

      // Verify persisted to file
      const lessonsPath = join(agentsRoot, "worker", "lessons.jsonl");
      assert.ok(existsSync(lessonsPath));
      const lines = readFileSync(lessonsPath, "utf-8").trim().split("\n");
      assert.strictEqual(lines.length, 2);
    });

    it("auto-extracts lessons from failure blockers", () => {
      const result = extractLessons(agentsRoot, "worker", "deploy to prod", {
        status: "failure",
        summary: "Deploy failed",
        blockers: [
          { reason: "No access to prod cluster", context: "Need VPN connection first" },
        ],
      });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].category, "fix");
      assert.ok(result[0].text.includes("No access to prod cluster"));
      assert.ok(result[0].text.includes("Need VPN connection first"));
      assert.strictEqual(result[0].confidence, 0.8);
    });

    it("deduplicates by incrementing validated_count", () => {
      // First extraction
      extractLessons(agentsRoot, "worker", "task 1", {
        status: "success",
        summary: "Done",
        lessons: [{ category: "fix", content: "Always commit from /app/agents directory" }],
      });

      // Second extraction with same lesson
      extractLessons(agentsRoot, "worker", "task 2", {
        status: "success",
        summary: "Done again",
        lessons: [{ category: "fix", content: "Always commit from the /app/agents directory" }],
      });

      // Should still be 1 lesson but with validated_count = 1
      const lessonsPath = join(agentsRoot, "worker", "lessons.jsonl");
      const lines = readFileSync(lessonsPath, "utf-8").trim().split("\n");
      assert.strictEqual(lines.length, 1);
      const lesson = JSON.parse(lines[0]);
      assert.strictEqual(lesson.validated_count, 1);
    });

    it("shares patterns and insights to shared pool", () => {
      extractLessons(agentsRoot, "worker", "task", {
        status: "success",
        summary: "Done",
        lessons: [
          { category: "pattern", content: "Run tests before committing" },
          { category: "fix", content: "Use correct path for git" },
        ],
      });

      const sharedPath = join(agentsRoot, "shared", "lessons.jsonl");
      assert.ok(existsSync(sharedPath));
      const lines = readFileSync(sharedPath, "utf-8").trim().split("\n");
      // Only the pattern should be shared, not the fix
      assert.strictEqual(lines.length, 1);
      const shared = JSON.parse(lines[0]);
      assert.strictEqual(shared.category, "pattern");
    });
  });

  describe("retrieveLessons", () => {
    it("returns empty string when no lessons exist", () => {
      const result = retrieveLessons(agentsRoot, "worker", "some task");
      assert.strictEqual(result, "");
    });

    it("returns formatted lessons section", () => {
      // Seed some lessons
      extractLessons(agentsRoot, "worker", "git operations", {
        status: "success",
        summary: "Done",
        lessons: [
          { category: "fix", content: "Always commit from /app/agents directory" },
          { category: "pattern", content: "Check git status before committing" },
        ],
      });

      const result = retrieveLessons(agentsRoot, "worker", "commit changes to git");
      assert.ok(result.startsWith("## Lessons from Experience"));
      assert.ok(result.includes("[fix] Always commit from /app/agents directory"));
      assert.ok(result.includes("[pattern] Check git status before committing"));
    });

    it("scores relevant lessons higher", () => {
      extractLessons(agentsRoot, "worker", "database migration", {
        status: "success",
        summary: "Done",
        lessons: [
          { category: "fix", content: "Always backup database before migration" },
        ],
      });
      extractLessons(agentsRoot, "worker", "git operations", {
        status: "success",
        summary: "Done",
        lessons: [
          { category: "fix", content: "Always commit from /app/agents directory" },
        ],
      });

      // Query about git should rank git lesson higher
      const result = retrieveLessons(agentsRoot, "worker", "commit the changes to git repository");
      const lines = result.split("\n").filter((l) => l.startsWith("- "));
      // Git lesson should come first
      assert.ok(lines[0].includes("commit"));
    });

    it("includes shared lessons from other agents", () => {
      // Another agent shares a pattern
      extractLessons(agentsRoot, "scout", "research task", {
        status: "success",
        summary: "Done",
        lessons: [
          { category: "pattern", content: "Always verify URLs are accessible before citing" },
        ],
      });

      // Worker should see it
      const result = retrieveLessons(agentsRoot, "worker", "research and document findings");
      assert.ok(result.includes("verify URLs"));
    });
  });

  describe("decayLessons", () => {
    it("decays old lessons", () => {
      const lessonsPath = join(agentsRoot, "worker", "lessons.jsonl");
      mkdirSync(join(agentsRoot, "worker"), { recursive: true });
      const oldLesson = {
        id: "test-id",
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        agent: "worker",
        category: "fix",
        text: "Old lesson",
        source_task: "old task",
        confidence: 1.0,
        validated_count: 0,
        last_relevant: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      writeFileSync(lessonsPath, JSON.stringify(oldLesson) + "\n");

      const decayed = decayLessons(agentsRoot, "worker");
      assert.ok(decayed > 0);

      // Lesson should have lower confidence now
      const content = readFileSync(lessonsPath, "utf-8").trim();
      if (content) {
        const lesson = JSON.parse(content);
        assert.ok(lesson.confidence < 1.0);
      }
    });
  });
});
