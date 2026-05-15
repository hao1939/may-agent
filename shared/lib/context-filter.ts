/**
 * Context Filter — EXP-235 Phase 3 (Option A)
 * 
 * Filters context entries based on task keywords before prompt assembly.
 * Achieves ~71% token reduction with 100% recall (validated in EXP-235).
 * 
 * Integration point: called by prompt-builder before injecting context.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const APP_ROOT = resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../../"
);
const AGENTS_ROOT = join(APP_ROOT, "agents");

// Universal entries always injected regardless of task
const ALWAYS_INJECT_MARKERS = [
  "Mandatory Procedures",
  "SESSION START",
  "WHEN RUNNING TOOLS",
  "BEFORE FINISH",
  "Lessons from Experience",
];

interface RuleMapping {
  id: string;
  keywords: string[];
  sectionMarker: string;
  skills: string[];
}

const RULE_MAPPINGS: RuleMapping[] = [
  { id: "rule1-trace-data-flow", keywords: ["bug", "fix", "wrong output", "incorrect", "error", "trace", "data flow"], sectionMarker: "WHEN MAKING CODE CHANGES", skills: ["verify-after-edit.md"] },
  { id: "rule2-destructive-ops", keywords: ["delete", "remove", "clean", "purge", "drop", "destroy", "rm"], sectionMarker: "WHEN MAKING CODE CHANGES", skills: [] },
  { id: "rule3-run-tests", keywords: ["test", "implement", "create", "build", "add", "fix", "change", "modify", "update"], sectionMarker: "WHEN MAKING CODE CHANGES", skills: [] },
  { id: "rule4-security", keywords: ["html", "xss", "sanitize", "security", "user input", "markdown", "render", "injection"], sectionMarker: "### Rule 4", skills: [] },
  { id: "rule5-full-pipeline", keywords: ["pipeline", "downstream", "cascade", "module", "integration", "chain", "flow"], sectionMarker: "### Rule 5", skills: ["multi-file-discovery-completeness.md"] },
  { id: "rule6-review", keywords: ["review", "pr", "pull request", "code review", "audit"], sectionMarker: "BEFORE FINISH", skills: [] },
  { id: "rule7-test-coverage", keywords: ["bug", "fix", "test", "regression", "edge case", "coverage"], sectionMarker: "### Rule 7", skills: [] },
  { id: "rule8-blocked", keywords: ["multiple", "items", "tasks", "list", "blocked", "missing"], sectionMarker: "### Rule 8", skills: ["task-instruction-compliance.md"] },
];

const METHODOLOGY_MAPPINGS = [
  { keywords: ["bug", "fix", "pipeline", "cascade", "downstream", "trace"], sectionMarker: "**Post-Fix Pipeline Trace**" },
  { keywords: ["test", "failing", "assertion", "expected", "actual"], sectionMarker: "**Test Assertion Skepticism**" },
  { keywords: ["contradiction", "conflict", "spec", "requirements", "inconsistent"], sectionMarker: "**Contradiction Detection**" },
  { keywords: ["impossible", "blocked", "cannot", "missing"], sectionMarker: "**Impossible Task Escalation**" },
  { keywords: ["mock", "test", "mysterious", "bypass", "leak"], sectionMarker: "**Mock Leak Awareness**" },
];

/**
 * Extract keywords from task description that match our rule mappings.
 */
function matchesKeywords(task: string, keywords: string[]): boolean {
  const lower = task.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Given a full context.md content and matched section markers,
 * extract only the relevant sections.
 */
function extractSections(content: string, markers: Set<string>): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inRelevantSection = false;
  let sectionDepth = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s/);

    if (headingMatch) {
      const depth = headingMatch[1].length;
      const isAlways = ALWAYS_INJECT_MARKERS.some(m => line.includes(m));
      const isMatched = [...markers].some(m => line.includes(m));

      if (isAlways || isMatched) {
        inRelevantSection = true;
        sectionDepth = depth;
        output.push(line);
        continue;
      }

      if (depth <= sectionDepth) {
        inRelevantSection = false;
      }
    }

    if (inRelevantSection) {
      output.push(line);
    }
  }

  return output.join("\n").trim();
}

export interface FilterResult {
  filteredContext: string;
  skills: string[];
  stats: { originalLines: number; filteredLines: number; reductionPct: number };
}

/**
 * Main entry point: filter an agent's context.md based on task description.
 * 
 * @param agentName - Name of the agent (e.g., "coder")
 * @param task - Task description string
 * @returns Filtered context and matched skills
 */
export function filterContext(agentName: string, task: string): FilterResult {
  const contextPath = join(AGENTS_ROOT, agentName, "context.md");
  
  if (!existsSync(contextPath)) {
    return { filteredContext: "", skills: [], stats: { originalLines: 0, filteredLines: 0, reductionPct: 0 } };
  }

  const content = readFileSync(contextPath, "utf-8");
  const matchedSections = new Set<string>();
  const matchedSkills: string[] = [];

  for (const rule of RULE_MAPPINGS) {
    if (matchesKeywords(task, rule.keywords)) {
      matchedSections.add(rule.sectionMarker);
      matchedSkills.push(...rule.skills);
    }
  }

  for (const m of METHODOLOGY_MAPPINGS) {
    if (matchesKeywords(task, m.keywords)) {
      matchedSections.add(m.sectionMarker);
    }
  }

  const filtered = extractSections(content, matchedSections);
  const originalLines = content.split("\n").length;
  const filteredLines = filtered.split("\n").length;

  return {
    filteredContext: filtered,
    skills: [...new Set(matchedSkills)],
    stats: {
      originalLines,
      filteredLines,
      reductionPct: Math.round((1 - filteredLines / originalLines) * 100),
    },
  };
}

/**
 * Load skill file contents for matched skills.
 */
export function loadSkills(agentName: string, skillFiles: string[]): string[] {
  const skillsDir = join(AGENTS_ROOT, agentName, "skills");
  const results: string[] = [];

  for (const file of skillFiles) {
    const path = join(skillsDir, file);
    if (existsSync(path)) {
      results.push(readFileSync(path, "utf-8").trim());
    }
  }

  return results;
}
