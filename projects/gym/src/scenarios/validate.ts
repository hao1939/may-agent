import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

import { isRunnableScenario, loadScenarioMeta } from "./catalog";
import type { ScenarioMeta } from "./types";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  scenario: string;
  code: string;
  detail: string;
}

export interface CorpusValidation {
  passed: boolean;
  directDirectories: number;
  runnableScenarios: number;
  partialDirectories: number;
  issues: ValidationIssue[];
}

const requiredEntries = ["scenario.json", "task.md", "success_criteria.js", "environment"] as const;
const tiers = new Set(["smoke", "standard", "full"]);

function validateMetadata(id: string, meta: ScenarioMeta | null, issues: ValidationIssue[]): void {
  if (!meta) {
    issues.push({ severity: "error", scenario: id, code: "metadata", detail: "Missing or invalid scenario.json" });
    return;
  }
  if (meta.name !== id.split("/").at(-1)) {
    issues.push({
      severity: "warning",
      scenario: id,
      code: "metadata-name",
      detail: `scenario.json name is '${String(meta.name)}'`,
    });
  }
  if (!Array.isArray(meta.categories) || meta.categories.length === 0) {
    issues.push({ severity: "warning", scenario: id, code: "metadata-categories", detail: "categories must be non-empty" });
  }
  if (!Array.isArray(meta.tags) || meta.tags.length === 0) {
    issues.push({ severity: "warning", scenario: id, code: "metadata-tags", detail: "tags must be non-empty" });
  }
  if (!tiers.has(meta.tier)) {
    issues.push({ severity: "warning", scenario: id, code: "metadata-tier", detail: `Non-standard tier '${String(meta.tier)}'` });
  }
  if (!Number.isFinite(meta.timeout) || meta.timeout <= 0) {
    issues.push({ severity: "warning", scenario: id, code: "metadata-timeout", detail: "timeout should be positive" });
  }
  if (typeof meta.agent_type !== "string" || !meta.agent_type) {
    issues.push({ severity: "warning", scenario: id, code: "metadata-agent", detail: "agent_type should be non-empty" });
  }
  if (typeof meta.workflow !== "boolean") {
    issues.push({ severity: "warning", scenario: id, code: "metadata-workflow", detail: "workflow should be boolean" });
  }
}

function inspectPortableLinks(root: string, scenario: string, issues: ValidationIssue[]): void {
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" && !lstatSync(join(dir, entry)).isSymbolicLink()) continue;
      const path = join(dir, entry);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(path);
        if (isAbsolute(target)) {
          issues.push({
            severity: "warning",
            scenario,
            code: "absolute-symlink",
            detail: `${relative(root, path)} -> ${target}`,
          });
        }
      } else if (stat.isDirectory()) {
        visit(path);
      }
    }
  };
  visit(root);
}

function validateScorerImport(scenarioDir: string, scenario: string, issues: ValidationIssue[]): void {
  const source = readFileSync(join(scenarioDir, "success_criteria.js"), "utf-8");
  if (/\b(?:lib|dist)\/gym-score-utils\.(?:c?js)\b/.test(source)) {
    issues.push({
      severity: "error",
      scenario,
      code: "generated-scorer-import",
      detail: 'Import shared scoring through "@may-agent/gym/scoring"',
    });
  }
}

export function validateScenarioCorpus(scenariosDir: string): CorpusValidation {
  const issues: ValidationIssue[] = [];
  let directDirectories = 0;
  let runnableScenarios = 0;
  let partialDirectories = 0;

  for (const name of readdirSync(scenariosDir).sort()) {
    const dir = join(scenariosDir, name);
    if (!statSync(dir).isDirectory()) continue;
    directDirectories++;

    if (name === "multi-session") {
      for (const child of readdirSync(dir).sort()) {
        const childDir = join(dir, child);
        if (!statSync(childDir).isDirectory()) continue;
        const meta = loadScenarioMeta(childDir);
        if (!meta?.sessions || !existsSync(join(childDir, "success_criteria.js"))) continue;
        runnableScenarios++;
        validateMetadata(`${name}/${child}`, meta, issues);
        validateScorerImport(childDir, `${name}/${child}`, issues);
        inspectPortableLinks(childDir, `${name}/${child}`, issues);
      }
      continue;
    }

    if (isRunnableScenario(dir)) {
      runnableScenarios++;
      validateMetadata(name, loadScenarioMeta(dir), issues);
      validateScorerImport(dir, name, issues);
      inspectPortableLinks(dir, name, issues);
      continue;
    }

    const present = requiredEntries.filter((entry) => existsSync(join(dir, entry)));
    if (present.length > 0) {
      partialDirectories++;
      const missing = requiredEntries.filter((entry) => !existsSync(join(dir, entry)));
      issues.push({
        severity: "warning",
        scenario: name,
        code: "partial-scenario",
        detail: `Not runnable; missing ${missing.join(", ")}`,
      });
    }
  }

  return {
    passed: !issues.some((issue) => issue.severity === "error"),
    directDirectories,
    runnableScenarios,
    partialDirectories,
    issues,
  };
}

export function formatValidation(result: CorpusValidation, verbose = false): string {
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.issues.filter((issue) => issue.severity === "warning");
  const lines = [
    `${result.passed ? "✓" : "✗"} scenario corpus: ${result.runnableScenarios} runnable, ${errors.length} errors, ${warnings.length} warnings`,
  ];
  for (const issue of result.issues) {
    if (!verbose && issue.severity === "warning") continue;
    lines.push(`  ${issue.severity === "error" ? "✗" : "⚠"} ${issue.scenario} [${issue.code}] ${issue.detail}`);
  }
  if (!verbose && warnings.length > 0) {
    const counts = new Map<string, number>();
    for (const warning of warnings) counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
    const groups = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([code, count]) => `${code}=${count}`)
      .join(", ");
    lines.push(`  Warnings: ${groups}`);
    lines.push("  Run `bun run scenario:validate -- --verbose` to review individual cases.");
  }
  return lines.join("\n");
}
