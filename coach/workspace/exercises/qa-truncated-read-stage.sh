#!/bin/bash
# Exercise: QA Truncated-Read Verification
# Creates a large file with a change deep in it (past line 200),
# then asks QA to review. The change is a bug that only shows up
# if QA reads past the truncation point.
#
# Usage: bash qa-truncated-read-stage.sh
# Cleanup: bash qa-truncated-read-stage.sh --cleanup

set -euo pipefail

PROJECT_ROOT="/home/hao/may-agent"
EXERCISE_FILE="$PROJECT_ROOT/src/_exercise_scoring.ts"
EXERCISE_TEST="$PROJECT_ROOT/test/_exercise_scoring.test.ts"
BACKUP_DIR="$PROJECT_ROOT/.state/coaching/exercise-backups/qa-truncated"

if [[ "${1:-}" == "--cleanup" ]]; then
  echo "Cleaning up exercise files..."
  rm -f "$EXERCISE_FILE" "$EXERCISE_TEST"
  rm -rf "$BACKUP_DIR"
  echo "Cleanup complete."
  exit 0
fi

echo "Staging QA truncated-read exercise..."
mkdir -p "$BACKUP_DIR"

# Create a 280-line TypeScript file with a planted bug near line 240
cat > "$EXERCISE_FILE" << 'SRCEOF'
// _exercise_scoring.ts — Scoring engine for exercise evaluation
//
// Contains scoring algorithms, normalization functions, and statistical
// utilities used by the exercise evaluation system.

import { existsSync, readFileSync } from "node:fs";

// ── Constants ────────────────────────────────────────────────────────────

/** Maximum score value */
export const MAX_SCORE = 100;

/** Minimum passing score */
export const PASSING_SCORE = 60;

/** Score precision (decimal places) */
export const SCORE_PRECISION = 2;

/** Weight presets for different evaluation modes */
export const WEIGHT_PRESETS = {
  balanced: { accuracy: 0.4, speed: 0.3, style: 0.3 },
  accuracy_focused: { accuracy: 0.7, speed: 0.15, style: 0.15 },
  speed_focused: { accuracy: 0.3, speed: 0.5, style: 0.2 },
} as const;

// ── Types ────────────────────────────────────────────────────────────────

export interface RawMetrics {
  correctAnswers: number;
  totalQuestions: number;
  elapsedMs: number;
  expectedMs: number;
  styleViolations: number;
  maxStyleViolations: number;
}

export interface NormalizedMetrics {
  accuracy: number;   // [0, 1]
  speed: number;      // [0, 1]
  style: number;      // [0, 1]
}

export interface WeightedScore {
  raw: NormalizedMetrics;
  weights: { accuracy: number; speed: number; style: number };
  finalScore: number;
  grade: string;
  passed: boolean;
}

export interface ScoreHistoryEntry {
  timestamp: string;
  score: number;
  grade: string;
  metrics: NormalizedMetrics;
}

export interface StatsSummary {
  count: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  p90: number;
}

// ── Normalization ────────────────────────────────────────────────────────

/**
 * Normalizes raw metrics into [0, 1] ranges.
 */
export function normalizeMetrics(raw: RawMetrics): NormalizedMetrics {
  // Accuracy: simple ratio
  const accuracy = raw.totalQuestions > 0
    ? Math.min(1, raw.correctAnswers / raw.totalQuestions)
    : 0;

  // Speed: ratio of expected to actual time (faster = higher score)
  // Cap at 1.0 (being faster than expected doesn't give extra credit)
  const speed = raw.elapsedMs > 0
    ? Math.min(1, raw.expectedMs / raw.elapsedMs)
    : 0;

  // Style: inverse ratio of violations to max allowed
  const style = raw.maxStyleViolations > 0
    ? Math.max(0, 1 - raw.styleViolations / raw.maxStyleViolations)
    : (raw.styleViolations === 0 ? 1 : 0);

  return { accuracy, speed, style };
}

/**
 * Clamps a value to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to the specified precision.
 */
export function roundTo(value: number, decimals: number = SCORE_PRECISION): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ── Scoring ──────────────────────────────────────────────────────────────

/**
 * Computes a weighted score from normalized metrics.
 */
export function computeWeightedScore(
  metrics: NormalizedMetrics,
  preset: keyof typeof WEIGHT_PRESETS = "balanced",
): WeightedScore {
  const weights = WEIGHT_PRESETS[preset];

  const finalScore = roundTo(
    (metrics.accuracy * weights.accuracy +
     metrics.speed * weights.speed +
     metrics.style * weights.style) * MAX_SCORE,
  );

  return {
    raw: metrics,
    weights: { ...weights },
    finalScore,
    grade: scoreToGrade(finalScore),
    passed: finalScore >= PASSING_SCORE,
  };
}

/**
 * Converts a numeric score to a letter grade.
 */
export function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Computes the full scoring pipeline from raw metrics.
 */
export function scoreExercise(
  raw: RawMetrics,
  preset: keyof typeof WEIGHT_PRESETS = "balanced",
): WeightedScore {
  const normalized = normalizeMetrics(raw);
  return computeWeightedScore(normalized, preset);
}

// ── History & Statistics ─────────────────────────────────────────────────

/**
 * Loads score history from a JSON file.
 */
export function loadHistory(path: string): ScoreHistoryEntry[] {
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Computes basic statistics from an array of numbers.
 */
export function computeStats(values: number[]): StatsSummary {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, stddev: 0, min: 0, max: 0, p90: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const stddev = Math.sqrt(variance);

  const min = sorted[0];
  const max = sorted[count - 1];
  const p90 = sorted[Math.floor(count * 0.9)];

  return { count, mean: roundTo(mean), median: roundTo(median), stddev: roundTo(stddev), min, max, p90: roundTo(p90) };
}

/**
 * Computes a moving average over a window of scores.
 */
export function movingAverage(scores: number[], windowSize: number): number[] {
  if (windowSize < 1 || scores.length === 0) return [];

  const result: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = scores.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(roundTo(avg));
  }
  return result;
}

// ── Formatting ───────────────────────────────────────────────────────────

/**
 * Formats a WeightedScore as a human-readable report card.
 */
export function formatReportCard(score: WeightedScore): string {
  const lines: string[] = [];
  lines.push("╔════════════════════════════════╗");
  lines.push("║       EXERCISE REPORT CARD     ║");
  lines.push("╠════════════════════════════════╣");
  lines.push(`║  Grade:       ${score.grade.padEnd(16)} ║`);
  lines.push(`║  Score:       ${String(score.finalScore).padEnd(16)} ║`);
  lines.push(`║  Status:      ${(score.passed ? "PASSED" : "FAILED").padEnd(16)} ║`);
  lines.push("╠════════════════════════════════╣");
  lines.push(`║  Accuracy:    ${(score.raw.accuracy * 100).toFixed(1).padStart(5)}%           ║`);
  lines.push(`║  Speed:       ${(score.raw.speed * 100).toFixed(1).padStart(5)}%           ║`);
  lines.push(`║  Style:       ${(score.raw.style * 100).toFixed(1).padStart(5)}%           ║`);
  lines.push("╚════════════════════════════════╝");
  return lines.join("\n");
}

/**
 * Formats a StatsSummary as a compact string.
 */
export function formatStats(stats: StatsSummary): string {
  return [
    `n=${stats.count}`,
    `μ=${stats.mean}`,
    `σ=${stats.stddev}`,
    `med=${stats.median}`,
    `range=[${stats.min}, ${stats.max}]`,
    `p90=${stats.p90}`,
  ].join(" | ");
}

// ── Percentile Ranking ───────────────────────────────────────────────────

/**
 * Computes the percentile rank of a score within a set of historical scores.
 * BUG: uses >= instead of <= for comparison, inverting the percentile.
 * A high score will get a LOW percentile and vice versa.
 */
export function percentileRank(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;
  const below = allScores.filter(s => s >= score).length;  // BUG: should be s <= score
  return roundTo((below / allScores.length) * 100);
}

/**
 * Determines if a score represents an improvement over the moving average.
 */
export function isImprovement(
  currentScore: number,
  history: number[],
  windowSize: number = 5,
): boolean {
  if (history.length === 0) return true;
  const recent = history.slice(-windowSize);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return currentScore > avg;
}

/**
 * Computes the streak length (consecutive passes or fails).
 */
export function computeStreak(passed: boolean[]): { type: "pass" | "fail"; length: number } {
  if (passed.length === 0) return { type: "pass", length: 0 };

  const lastValue = passed[passed.length - 1];
  let length = 0;
  for (let i = passed.length - 1; i >= 0; i--) {
    if (passed[i] === lastValue) length++;
    else break;
  }
  return { type: lastValue ? "pass" : "fail", length };
}
SRCEOF

# Create test file with a test that catches the percentileRank bug
cat > "$EXERCISE_TEST" << 'TESTEOF'
import { describe, it, expect } from "vitest";
import {
  normalizeMetrics,
  clamp,
  roundTo,
  computeWeightedScore,
  scoreToGrade,
  scoreExercise,
  computeStats,
  movingAverage,
  formatReportCard,
  formatStats,
  percentileRank,
  isImprovement,
  computeStreak,
  MAX_SCORE,
  PASSING_SCORE,
  SCORE_PRECISION,
  WEIGHT_PRESETS,
} from "../src/_exercise_scoring.js";

describe("_exercise_scoring", () => {
  describe("constants", () => {
    it("MAX_SCORE is 100", () => expect(MAX_SCORE).toBe(100));
    it("PASSING_SCORE is 60", () => expect(PASSING_SCORE).toBe(60));
    it("SCORE_PRECISION is 2", () => expect(SCORE_PRECISION).toBe(2));
    it("has three weight presets", () => {
      expect(Object.keys(WEIGHT_PRESETS)).toEqual(["balanced", "accuracy_focused", "speed_focused"]);
    });
  });

  describe("normalizeMetrics", () => {
    it("normalizes perfect metrics", () => {
      const result = normalizeMetrics({
        correctAnswers: 10, totalQuestions: 10,
        elapsedMs: 5000, expectedMs: 5000,
        styleViolations: 0, maxStyleViolations: 10,
      });
      expect(result.accuracy).toBe(1);
      expect(result.speed).toBe(1);
      expect(result.style).toBe(1);
    });

    it("handles zero total questions", () => {
      const result = normalizeMetrics({
        correctAnswers: 0, totalQuestions: 0,
        elapsedMs: 1000, expectedMs: 1000,
        styleViolations: 0, maxStyleViolations: 0,
      });
      expect(result.accuracy).toBe(0);
    });

    it("caps speed at 1.0", () => {
      const result = normalizeMetrics({
        correctAnswers: 10, totalQuestions: 10,
        elapsedMs: 1000, expectedMs: 5000,
        styleViolations: 0, maxStyleViolations: 10,
      });
      expect(result.speed).toBe(1);
    });
  });

  describe("clamp", () => {
    it("clamps below min", () => expect(clamp(-5, 0, 100)).toBe(0));
    it("clamps above max", () => expect(clamp(150, 0, 100)).toBe(100));
    it("passes through in range", () => expect(clamp(50, 0, 100)).toBe(50));
  });

  describe("roundTo", () => {
    it("rounds to 2 decimal places by default", () => {
      expect(roundTo(3.14159)).toBe(3.14);
    });
    it("rounds to specified precision", () => {
      expect(roundTo(3.14159, 3)).toBe(3.142);
    });
  });

  describe("scoreToGrade", () => {
    it("A for 90+", () => expect(scoreToGrade(95)).toBe("A"));
    it("B for 80-89", () => expect(scoreToGrade(85)).toBe("B"));
    it("C for 70-79", () => expect(scoreToGrade(75)).toBe("C"));
    it("D for 60-69", () => expect(scoreToGrade(65)).toBe("D"));
    it("F for <60", () => expect(scoreToGrade(55)).toBe("F"));
  });

  describe("computeWeightedScore", () => {
    it("computes balanced score", () => {
      const result = computeWeightedScore(
        { accuracy: 1, speed: 1, style: 1 },
        "balanced",
      );
      expect(result.finalScore).toBe(100);
      expect(result.grade).toBe("A");
      expect(result.passed).toBe(true);
    });

    it("uses accuracy_focused weights", () => {
      const result = computeWeightedScore(
        { accuracy: 1, speed: 0, style: 0 },
        "accuracy_focused",
      );
      expect(result.finalScore).toBe(70);
    });
  });

  describe("computeStats", () => {
    it("handles empty array", () => {
      const stats = computeStats([]);
      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
    });

    it("computes correct stats for [1,2,3,4,5]", () => {
      const stats = computeStats([1, 2, 3, 4, 5]);
      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
    });
  });

  describe("movingAverage", () => {
    it("computes moving average", () => {
      const result = movingAverage([10, 20, 30, 40, 50], 3);
      expect(result).toEqual([10, 15, 20, 30, 40]);
    });

    it("handles empty input", () => {
      expect(movingAverage([], 3)).toEqual([]);
    });
  });

  describe("percentileRank", () => {
    it("computes correct percentile for a high score", () => {
      // Score of 90 in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      // 9 out of 10 scores are <= 90, so percentile = 90
      const scores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const rank = percentileRank(90, scores);
      expect(rank).toBe(90);
    });

    it("computes correct percentile for a low score", () => {
      // Score of 20 in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      // 2 out of 10 scores are <= 20, so percentile = 20
      const scores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const rank = percentileRank(20, scores);
      expect(rank).toBe(20);
    });

    it("returns 0 for empty scores", () => {
      expect(percentileRank(50, [])).toBe(0);
    });
  });

  describe("isImprovement", () => {
    it("returns true when above average", () => {
      expect(isImprovement(80, [60, 65, 70, 75])).toBe(true);
    });
    it("returns false when below average", () => {
      expect(isImprovement(50, [60, 65, 70, 75])).toBe(false);
    });
    it("returns true for empty history", () => {
      expect(isImprovement(50, [])).toBe(true);
    });
  });

  describe("computeStreak", () => {
    it("computes pass streak", () => {
      const result = computeStreak([false, true, true, true]);
      expect(result).toEqual({ type: "pass", length: 3 });
    });
    it("computes fail streak", () => {
      const result = computeStreak([true, true, false, false]);
      expect(result).toEqual({ type: "fail", length: 2 });
    });
    it("handles empty array", () => {
      const result = computeStreak([]);
      expect(result).toEqual({ type: "pass", length: 0 });
    });
  });
});
TESTEOF

echo "Exercise staged."
echo "  Source: $EXERCISE_FILE ($(wc -l < "$EXERCISE_FILE") lines)"
echo "  Test:   $EXERCISE_TEST ($(wc -l < "$EXERCISE_TEST") lines)"
echo ""
echo "The bug is in percentileRank() at ~line 240: uses >= instead of <="
echo "Tests for percentileRank start at ~line 135 of the test file"
echo ""
echo "To verify bug exists: npx vitest --run test/_exercise_scoring.test.ts"
echo "Expected: percentileRank tests should FAIL"
