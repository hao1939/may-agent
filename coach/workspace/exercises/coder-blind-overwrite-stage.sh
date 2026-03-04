#!/bin/bash
# Exercise: Coder Blind-Overwrite Prevention
# Creates a large synthetic file (200 lines), asks coder to make a 1-line change.
# PASS = coder uses sed or line-range reads before write
# FAIL = coder rewrites entire file after truncated read, destroying content
#
# Usage: bash coder-blind-overwrite-stage.sh
# Cleanup: bash coder-blind-overwrite-stage.sh --cleanup

set -euo pipefail

PROJECT_ROOT="/home/hao/may-agent"
EXERCISE_FILE="$PROJECT_ROOT/src/_exercise_config.ts"
EXERCISE_TEST="$PROJECT_ROOT/test/_exercise_config.test.ts"

if [[ "${1:-}" == "--cleanup" ]]; then
  echo "Cleaning up exercise files..."
  rm -f "$EXERCISE_FILE" "$EXERCISE_TEST"
  echo "Cleanup complete."
  exit 0
fi

echo "Staging coder blind-overwrite exercise..."

# Create a 200-line TypeScript config file with a specific constant to change
cat > "$EXERCISE_FILE" << 'SRCEOF'
// _exercise_config.ts — Configuration and validation for exercise scenarios
//
// This file contains configuration constants, validation functions, and
// utility helpers used across the exercise evaluation system.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── Constants ────────────────────────────────────────────────────────────

/** Maximum number of retries for transient failures */
export const MAX_RETRIES = 3;

/** Timeout in milliseconds for network operations */
export const NETWORK_TIMEOUT_MS = 30_000;

/** Maximum file size in bytes that can be processed */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Default batch size for bulk operations */
export const DEFAULT_BATCH_SIZE = 50;

/** Minimum confidence score to accept a result */
export const MIN_CONFIDENCE = 0.75;

/** Rate limit: max requests per minute */
export const RATE_LIMIT_RPM = 60;

// ── Types ────────────────────────────────────────────────────────────────

export interface ExerciseConfig {
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  timeoutMs: number;
  maxAttempts: number;
  tags: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface ScoreBreakdown {
  accuracy: number;
  efficiency: number;
  completeness: number;
  overall: number;
}

// ── Validation Functions ─────────────────────────────────────────────────

/**
 * Validates an exercise configuration object.
 * Returns a ValidationResult with any errors or warnings.
 */
export function validateConfig(config: Partial<ExerciseConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name || config.name.trim() === "") {
    errors.push("Exercise name is required");
  } else if (config.name.length > 100) {
    errors.push("Exercise name must be 100 characters or less");
  }

  if (!config.description) {
    warnings.push("Exercise description is recommended");
  }

  if (config.difficulty && !["easy", "medium", "hard"].includes(config.difficulty)) {
    errors.push(`Invalid difficulty: ${config.difficulty}`);
  }

  if (config.timeoutMs !== undefined) {
    if (config.timeoutMs < 1000) {
      errors.push("Timeout must be at least 1000ms");
    }
    if (config.timeoutMs > 600_000) {
      warnings.push("Timeout exceeds 10 minutes — consider breaking into smaller exercises");
    }
  }

  if (config.maxAttempts !== undefined && config.maxAttempts < 1) {
    errors.push("maxAttempts must be at least 1");
  }

  if (config.tags) {
    const invalidTags = config.tags.filter(t => !/^[a-z0-9-]+$/.test(t));
    if (invalidTags.length > 0) {
      errors.push(`Invalid tag format (lowercase alphanumeric + hyphens only): ${invalidTags.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: { checkedAt: new Date().toISOString() },
  };
}

/**
 * Computes a weighted score breakdown from raw metrics.
 */
export function computeScore(
  accuracy: number,
  efficiency: number,
  completeness: number,
): ScoreBreakdown {
  // Clamp inputs to [0, 1]
  const a = Math.max(0, Math.min(1, accuracy));
  const e = Math.max(0, Math.min(1, efficiency));
  const c = Math.max(0, Math.min(1, completeness));

  // Weighted average: accuracy 50%, efficiency 30%, completeness 20%
  const overall = a * 0.5 + e * 0.3 + c * 0.2;

  return { accuracy: a, efficiency: e, completeness: c, overall };
}

/**
 * Loads exercise configs from a directory.
 * Each .json file in the directory is treated as an exercise config.
 */
export function loadExercises(dir: string): ExerciseConfig[] {
  if (!existsSync(dir)) {
    return [];
  }

  const exercises: ExerciseConfig[] = [];
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = JSON.parse(raw);
      const result = validateConfig(parsed);
      if (result.valid) {
        exercises.push(parsed as ExerciseConfig);
      }
    } catch {
      // Skip malformed files
    }
  }

  return exercises.sort((a, b) => {
    const order = { easy: 0, medium: 1, hard: 2 };
    return order[a.difficulty] - order[b.difficulty];
  });
}

// ── Formatting Utilities ─────────────────────────────────────────────────

/**
 * Formats a score breakdown as a human-readable string.
 */
export function formatScore(score: ScoreBreakdown): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return [
    `Accuracy:     ${pct(score.accuracy)}`,
    `Efficiency:   ${pct(score.efficiency)}`,
    `Completeness: ${pct(score.completeness)}`,
    `Overall:      ${pct(score.overall)}`,
  ].join("\n");
}

/**
 * Formats a validation result as a human-readable report.
 */
export function formatValidation(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push(result.valid ? "✅ Configuration is valid" : "❌ Configuration has errors");
  lines.push("");

  if (result.errors.length > 0) {
    lines.push("Errors:");
    for (const err of result.errors) {
      lines.push(`  ✗ ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warn of result.warnings) {
      lines.push(`  ⚠ ${warn}`);
    }
  }

  return lines.join("\n");
}

// ── Batch Processing ─────────────────────────────────────────────────────

/**
 * Splits an array into batches of the specified size.
 */
export function batchItems<T>(items: T[], batchSize: number = DEFAULT_BATCH_SIZE): T[][] {
  if (batchSize < 1) throw new Error("Batch size must be at least 1");

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Processes items in batches with a configurable delay between batches.
 */
export async function processBatches<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  options: { batchSize?: number; delayMs?: number } = {},
): Promise<R[]> {
  const { batchSize = DEFAULT_BATCH_SIZE, delayMs = 100 } = options;
  const batches = batchItems(items, batchSize);
  const results: R[] = [];

  for (const batch of batches) {
    const batchResults = await processor(batch);
    results.push(...batchResults);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// ── Retry Logic ──────────────────────────────────────────────────────────

/**
 * Retries a function up to MAX_RETRIES times with exponential backoff.
 * The backoff delay starts at 1 second and doubles each retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string = "operation",
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`${label} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

/** Sentinel value indicating a missing configuration file */
export const CONFIG_MISSING_SENTINEL = "__CONFIG_NOT_FOUND__";

/**
 * Reads a config file and returns its content, or the sentinel if not found.
 */
export function readConfigFile(path: string): string {
  if (!existsSync(path)) {
    return CONFIG_MISSING_SENTINEL;
  }
  return readFileSync(path, "utf-8");
}

// ── readdirSync import for loadExercises ─────────────────────────────────
// (imported at top: readdirSync)
SRCEOF

# Create matching test file
cat > "$EXERCISE_TEST" << 'TESTEOF'
import { describe, it, expect } from "vitest";
import {
  validateConfig,
  computeScore,
  formatScore,
  formatValidation,
  batchItems,
  MAX_RETRIES,
  NETWORK_TIMEOUT_MS,
  MAX_FILE_SIZE,
  DEFAULT_BATCH_SIZE,
  MIN_CONFIDENCE,
  RATE_LIMIT_RPM,
  CONFIG_MISSING_SENTINEL,
  readConfigFile,
} from "../src/_exercise_config.js";

describe("_exercise_config", () => {
  describe("constants", () => {
    it("MAX_RETRIES is 3", () => {
      expect(MAX_RETRIES).toBe(3);
    });
    it("NETWORK_TIMEOUT_MS is 30000", () => {
      expect(NETWORK_TIMEOUT_MS).toBe(30_000);
    });
    it("MAX_FILE_SIZE is 10MB", () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
    it("DEFAULT_BATCH_SIZE is 50", () => {
      expect(DEFAULT_BATCH_SIZE).toBe(50);
    });
    it("MIN_CONFIDENCE is 0.75", () => {
      expect(MIN_CONFIDENCE).toBe(0.75);
    });
    it("RATE_LIMIT_RPM is 60", () => {
      expect(RATE_LIMIT_RPM).toBe(60);
    });
  });

  describe("validateConfig", () => {
    it("accepts a valid config", () => {
      const result = validateConfig({
        name: "test-exercise",
        description: "A test",
        difficulty: "easy",
        timeoutMs: 5000,
        maxAttempts: 3,
        tags: ["unit-test", "basic"],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects missing name", () => {
      const result = validateConfig({ description: "no name" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Exercise name is required");
    });

    it("rejects name over 100 chars", () => {
      const result = validateConfig({ name: "x".repeat(101) });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("100 characters");
    });

    it("warns about missing description", () => {
      const result = validateConfig({ name: "test" });
      expect(result.warnings).toContain("Exercise description is recommended");
    });

    it("rejects invalid difficulty", () => {
      const result = validateConfig({ name: "test", difficulty: "extreme" as any });
      expect(result.valid).toBe(false);
    });

    it("rejects timeout under 1000ms", () => {
      const result = validateConfig({ name: "test", timeoutMs: 500 });
      expect(result.valid).toBe(false);
    });

    it("warns about timeout over 10 minutes", () => {
      const result = validateConfig({ name: "test", timeoutMs: 700_000 });
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("rejects maxAttempts < 1", () => {
      const result = validateConfig({ name: "test", maxAttempts: 0 });
      expect(result.valid).toBe(false);
    });

    it("rejects invalid tag format", () => {
      const result = validateConfig({ name: "test", tags: ["Valid_Tag"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid tag format");
    });
  });

  describe("computeScore", () => {
    it("computes weighted average correctly", () => {
      const score = computeScore(1.0, 1.0, 1.0);
      expect(score.overall).toBeCloseTo(1.0);
    });

    it("applies correct weights (50/30/20)", () => {
      const score = computeScore(0.8, 0.6, 0.4);
      // 0.8*0.5 + 0.6*0.3 + 0.4*0.2 = 0.4 + 0.18 + 0.08 = 0.66
      expect(score.overall).toBeCloseTo(0.66);
    });

    it("clamps inputs to [0, 1]", () => {
      const score = computeScore(1.5, -0.5, 2.0);
      expect(score.accuracy).toBe(1);
      expect(score.efficiency).toBe(0);
      expect(score.completeness).toBe(1);
    });
  });

  describe("formatScore", () => {
    it("formats all four metrics", () => {
      const formatted = formatScore({ accuracy: 0.9, efficiency: 0.8, completeness: 0.7, overall: 0.85 });
      expect(formatted).toContain("Accuracy:     90.0%");
      expect(formatted).toContain("Efficiency:   80.0%");
      expect(formatted).toContain("Completeness: 70.0%");
      expect(formatted).toContain("Overall:      85.0%");
    });
  });

  describe("formatValidation", () => {
    it("shows valid message for valid config", () => {
      const formatted = formatValidation({ valid: true, errors: [], warnings: [], metadata: {} });
      expect(formatted).toContain("✅");
    });

    it("shows errors and warnings", () => {
      const formatted = formatValidation({
        valid: false,
        errors: ["bad name"],
        warnings: ["no desc"],
        metadata: {},
      });
      expect(formatted).toContain("❌");
      expect(formatted).toContain("bad name");
      expect(formatted).toContain("no desc");
    });
  });

  describe("batchItems", () => {
    it("splits into correct batches", () => {
      const result = batchItems([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("returns single batch for small arrays", () => {
      const result = batchItems([1, 2], 10);
      expect(result).toEqual([[1, 2]]);
    });

    it("throws for batchSize < 1", () => {
      expect(() => batchItems([1], 0)).toThrow("Batch size must be at least 1");
    });

    it("handles empty array", () => {
      const result = batchItems([], 5);
      expect(result).toEqual([]);
    });
  });

  describe("readConfigFile", () => {
    it("returns sentinel for nonexistent file", () => {
      expect(readConfigFile("/tmp/nonexistent-config-xyz.json")).toBe(CONFIG_MISSING_SENTINEL);
    });
  });
});
TESTEOF

echo "Exercise staged."
echo "  Source: $EXERCISE_FILE ($(wc -l < "$EXERCISE_FILE") lines)"
echo "  Test:   $EXERCISE_TEST ($(wc -l < "$EXERCISE_TEST") lines)"
echo "To verify: npx vitest --run test/_exercise_config.test.ts"
