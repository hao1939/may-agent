import { describe, it, expect } from "bun:test";
import { parseMetrics, isAtTarget, extractLastActivity, isStalled, analyzeProject, checkHealth } from "../workflows/health-check.js";

describe("health-check", () => {
  describe("parseMetrics", () => {
    it("parses standard table rows", () => {
      const content = "| tests | 50 | 40 |\n| coverage | 80% | 75% |";
      const metrics = parseMetrics(content);
      expect(metrics).toHaveLength(2);
      expect(metrics[0]).toEqual({ name: "tests", current: "50", target: "40", atTarget: true });
    });

    it("skips header rows", () => {
      const content = "| Metric | Current | Target |\n| --- | --- | --- |\n| tests | 50 | 40 |";
      expect(parseMetrics(content)).toHaveLength(1);
    });

    it("returns empty for no table content", () => {
      expect(parseMetrics("# Project\nSome text")).toEqual([]);
    });

    it("handles whitespace in cells", () => {
      const content = "|  tests  |  50  |  40  |";
      const metrics = parseMetrics(content);
      expect(metrics[0].name).toBe("tests");
    });
  });

  describe("isAtTarget", () => {
    it("returns true for equal strings", () => {
      expect(isAtTarget("done", "done")).toBe(true);
    });

    it("handles numeric >=", () => {
      expect(isAtTarget("50", "40")).toBe(true);
      expect(isAtTarget("30", "40")).toBe(false);
    });

    it("handles percentage comparison", () => {
      expect(isAtTarget("85%", "80%")).toBe(true);
      expect(isAtTarget("70%", "80%")).toBe(false);
    });

    it("handles fraction format", () => {
      expect(isAtTarget("5/5", "3/5")).toBe(true);
      expect(isAtTarget("2/5", "3/5")).toBe(false);
    });

    it("handles ≥X target format", () => {
      expect(isAtTarget("50", "≥40")).toBe(true);
      expect(isAtTarget("30", "≥40")).toBe(false);
    });

    it("returns false for empty values", () => {
      expect(isAtTarget("", "40")).toBe(false);
      expect(isAtTarget("50", "")).toBe(false);
    });
  });

  describe("extractLastActivity", () => {
    it("extracts ISO timestamp", () => {
      const content = "Updated at 2024-01-15T10:30:00Z";
      expect(extractLastActivity(content)).toBe("2024-01-15T10:30:00Z");
    });

    it("extracts date only", () => {
      const content = "Last run: 2024-03-01";
      expect(extractLastActivity(content)).toBe("2024-03-01");
    });

    it("returns null for empty content", () => {
      expect(extractLastActivity("")).toBeNull();
      expect(extractLastActivity("no dates here")).toBeNull();
    });

    it("picks the latest date", () => {
      const content = "First: 2024-01-01T00:00:00Z\nLast: 2024-06-15T12:00:00Z";
      expect(extractLastActivity(content)).toBe("2024-06-15T12:00:00Z");
    });
  });

  describe("isStalled", () => {
    const now = new Date("2024-06-15T12:00:00Z");

    it("returns true for null activity", () => {
      expect(isStalled(null, now)).toBe(true);
    });

    it("returns true for old activity", () => {
      expect(isStalled("2024-06-10T00:00:00Z", now)).toBe(true);
    });

    it("returns false for recent activity", () => {
      expect(isStalled("2024-06-15T10:00:00Z", now)).toBe(false);
    });

    it("returns true for invalid date string", () => {
      expect(isStalled("not-a-date", now)).toBe(true);
    });

    it("respects custom threshold", () => {
      const threshold = 7 * 24 * 60 * 60 * 1000; // 7 days
      expect(isStalled("2024-06-10T00:00:00Z", now, threshold)).toBe(false);
    });
  });

  describe("analyzeProject", () => {
    const now = new Date("2024-06-15T12:00:00Z");

    it("returns missing for null content", () => {
      const result = analyzeProject("test", null, null, now);
      expect(result.status).toBe("missing");
    });

    it("returns malformed for empty content", () => {
      const result = analyzeProject("test", "", null, now);
      expect(result.status).toBe("malformed");
    });

    it("returns healthy when all metrics at target and active", () => {
      const project = "| tests | 50 | 40 |";
      const journal = "Updated 2024-06-15T11:00:00Z";
      const result = analyzeProject("test", project, journal, now);
      expect(result.status).toBe("healthy");
    });

    it("returns stalled when inactive and metrics not met", () => {
      const project = "| tests | 30 | 40 |";
      const journal = "Updated 2024-06-01T00:00:00Z";
      const result = analyzeProject("test", project, journal, now);
      expect(result.status).toBe("stalled");
    });

    it("includes issues for missing activity", () => {
      const project = "| tests | 50 | 40 |";
      const result = analyzeProject("test", project, null, now);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("checkHealth", () => {
    const now = new Date("2024-06-15T12:00:00Z");

    it("returns report with correct summary counts", () => {
      const projects = [
        { name: "a", projectContent: "| x | 5 | 3 |", journalContent: "2024-06-15T11:00:00Z" },
        { name: "b", projectContent: null, journalContent: null },
      ];
      const report = checkHealth(projects, now);
      expect(report.summary.total).toBe(2);
      expect(report.summary.healthy).toBe(1);
      expect(report.summary.missing).toBe(1);
    });

    it("includes timestamp", () => {
      const report = checkHealth([], now);
      expect(report.timestamp).toBe("2024-06-15T12:00:00.000Z");
    });

    it("handles empty project list", () => {
      const report = checkHealth([], now);
      expect(report.projects).toEqual([]);
      expect(report.summary.total).toBe(0);
    });
  });
});
