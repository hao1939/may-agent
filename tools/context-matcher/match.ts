#!/usr/bin/env node
/**
 * Context Matcher — Task-Aware Context Injection (EXP-235)
 * 
 * Given a task description and an agent name, selects only the relevant
 * context sections and skills to inject. Achieves ~71% token reduction
 * with 100% recall (validated in EXP-235).
 * 
 * Usage:
 *   node match.js <agent> "<task description>"
 *   node match.js coder "Fix bug: calculator returns wrong output"
 * 
 * Output: filtered context.md content to stdout
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const AGENTS_ROOT = resolve(import.meta.dirname, "../..");

// ── Keyword → Section/Rule mapping ──────────────────────────────
// Each entry: { keywords: string[], sections: string[], skills: string[] }
// "sections" are heading markers in context.md; "skills" are filenames in skills/

const ALWAYS_INJECT = [
  "## Mandatory Procedures",      // C1.1, C1.3, C12.1 — always relevant
  "## Lessons from Experience",    // short, always useful
];

const RULES = [
  {
    id: "rule1-trace-data-flow",
    keywords: ["bug", "fix", "wrong output", "incorrect", "error", "trace", "data flow"],
    section: "### Rule 1: Trace Data Flow",
    skills: ["diagnosis-before-action.md"],
  },
  {
    id: "rule2-destructive-ops",
    keywords: ["delete", "remove", "clean", "purge", "drop", "destroy", "rm"],
    section: "### Rule 2: Exercise Judgment on Destructive",
    skills: [],
  },
  {
    id: "rule3-run-tests",
    keywords: ["test", "implement", "create", "build", "add", "fix", "change", "modify", "update"],
    section: "### Rule 3: Run Tests AND Report",
    skills: [],
  },
  {
    id: "rule4-security",
    keywords: ["html", "xss", "sanitize", "security", "user input", "markdown", "render", "injection"],
    section: "### Rule 4: Check for Security",
    skills: [],
  },
  {
    id: "rule5-full-pipeline",
    keywords: ["pipeline", "downstream", "cascade", "module", "integration", "chain", "flow"],
    section: "### Rule 5: Re-run Full Pipeline",
    skills: ["multi-file-discovery-completeness.md"],
  },
  {
    id: "rule6-review",
    keywords: ["review", "pr", "pull request", "code review", "audit", "check"],
    section: "### Rule 6: Calibrate Review Severity",
    skills: ["second-look-verification.md"],
  },
  {
    id: "rule7-test-coverage",
    keywords: ["bug", "fix", "test", "regression", "edge case", "coverage"],
    section: "### Rule 7: Add Test Coverage",
    skills: [],
  },
  {
    id: "rule8-blocked",
    keywords: ["multiple", "items", "tasks", "list", "blocked", "missing"],
    section: "### Rule 8: When Blocked",
    skills: ["task-instruction-compliance.md"],
  },
];

const METHODOLOGY = [
  {
    id: "methodology-post-fix-trace",
    keywords: ["bug", "fix", "pipeline", "cascade", "downstream", "trace"],
    section: "**Post-Fix Pipeline Trace**",
  },
  {
    id: "methodology-test-skepticism",
    keywords: ["test", "failing", "assertion", "expected", "actual"],
    section: "**Test Assertion Skepticism**",
  },
  {
    id: "methodology-contradiction",
    keywords: ["contradiction", "conflict", "spec", "requirements", "inconsistent"],
    section: "**Contradiction Detection**",
  },
  {
    id: "methodology-impossible",
    keywords: ["impossible", "blocked", "cannot", "missing"],
    section: "**Impossible Task Escalation**",
  },
  {
    id: "methodology-mock-leak",
    keywords: ["mock", "test", "mysterious", "bypass", "leak"],
    section: "**Mock Leak Awareness**",
  },
];

// ── Matching logic ──────────────────────────────────────────────

function matchKeywords(task, keywords) {
  const lower = task.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function selectRules(task) {
  const matched = { sections: new Set(), skills: new Set() };
  
  for (const rule of RULES) {
    if (matchKeywords(task, rule.keywords)) {
      matched.sections.add(rule.section);
      rule.skills.forEach(s => matched.skills.add(s));
    }
  }
  
  for (const m of METHODOLOGY) {
    if (matchKeywords(task, m.keywords)) {
      matched.sections.add(m.section);
    }
  }
  
  return matched;
}

// ── Section extraction from context.md ──────────────────────────

function extractSections(contextContent, sectionMarkers) {
  const lines = contextContent.split("\n");
  const output = [];
  
  // Always inject mandatory sections
  let inAlwaysSection = false;
  let inMatchedSection = false;
  let sectionDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = line.match(/^(#{1,4})\s/);
    
    if (isHeading) {
      const depth = isHeading[1].length;
      
      // Check if this starts an always-inject section
      const isAlways = ALWAYS_INJECT.some(marker => line.startsWith(marker));
      if (isAlways) {
        inAlwaysSection = true;
        inMatchedSection = false;
        sectionDepth = depth;
        output.push(line);
        continue;
      }
      
      // Check if this starts a matched section
      const isMatched = [...sectionMarkers].some(marker => line.includes(marker));
      if (isMatched) {
        inMatchedSection = true;
        inAlwaysSection = false;
        sectionDepth = depth;
        output.push(line);
        continue;
      }
      
      // New heading at same or higher level ends current section
      if (depth <= sectionDepth) {
        inAlwaysSection = false;
        inMatchedSection = false;
      }
    }
    
    if (inAlwaysSection || inMatchedSection) {
      output.push(line);
    }
  }
  
  return output.join("\n").trim();
}

// ── Main ────────────────────────────────────────────────────────

const [agentName, task] = process.argv.slice(2);

if (!agentName || !task) {
  console.error("Usage: node match.js <agent> \"<task description>\"");
  process.exit(1);
}

const agentDir = join(AGENTS_ROOT, agentName);
const contextPath = join(agentDir, "context.md");
const skillsDir = join(agentDir, "skills");

if (!existsSync(contextPath)) {
  console.error(`No context.md found for agent: ${agentName}`);
  process.exit(1);
}

const contextContent = readFileSync(contextPath, "utf-8");
const { sections, skills } = selectRules(task);

// Extract matched sections
const filtered = extractSections(contextContent, sections);

// Output
console.log("# Filtered Context for Task");
console.log(`# Agent: ${agentName}`);
console.log(`# Task: ${task}`);
console.log(`# Sections matched: ${sections.size}`);
console.log(`# Skills matched: ${skills.size}`);
console.log();
console.log(filtered);

// Append matched skills
if (skills.size > 0) {
  console.log("\n---\n## Relevant Skills\n");
  for (const skillFile of skills) {
    const skillPath = join(skillsDir, skillFile);
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, "utf-8");
      console.log(`### ${skillFile}\n`);
      console.log(content.trim());
      console.log();
    }
  }
}

// Stats
const originalLines = contextContent.split("\n").length;
const filteredLines = filtered.split("\n").length;
const reduction = Math.round((1 - filteredLines / originalLines) * 100);
console.error(`\n[context-matcher] ${originalLines} → ${filteredLines} lines (${reduction}% reduction), ${skills.size} skills`);
