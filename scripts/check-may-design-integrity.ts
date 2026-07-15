#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const designDir = join(root, "projects", "may-agent.app", "docs", "2a-design");
const principlesDir = join(root, "projects", "may-agent.app", "docs", "1-principles");
const manualDir = join(root, "projects", "may-agent.app", "docs", "2b-manual");
const errors: string[] = [];
const warnings: string[] = [];

const mixedAuthorityHeading =
  /^## (?:Proposal|Implementation Plan|Implementation Slices|Migration Plan|Migration steps|Open Questions|Open questions|Open Problems|Recommended Next Step)\b/m;
const staleContractPatterns: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bescalate\(reason: string, context\?: unknown\): WorkflowResult/,
    message: "workflow terminal API must use blocked(), not a local escalate alias",
  },
  {
    pattern: /`claude-code`\s*\/\s*`gemini-cli`\s*\/\s*`codex`/,
    message: "direct CLI worker presets are retired; use cli-delegation/run_cli_agent",
  },
  {
    pattern: /SDK now also exports[\s\S]{0,240}`workflowHandlers`/,
    message: "workflowHandlers is a manifest field, not an exported helper",
  },
  {
    pattern: /`project\.problem\.requested`/,
    message: "project.problem.requested is retired; use project.problem.investigation.requested",
  },
  {
    pattern: /experience\s*->\s*lesson\s*->\s*skill\s*->\s*workflow/,
    message: "knowledge encoding and runtime mechanisms are separate choices, not one maturity ladder",
  },
];

function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => join(dir, entry));
}

function relativeDocPath(path: string): string {
  return path.slice(root.length + 1);
}

function checkMarkdownLinks(path: string, text: string): void {
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = match[1];
    if (/^(?:https?:|\/)/.test(target)) continue;
    const resolved = resolve(dirname(path), target);
    if (!existsSync(resolved)) {
      errors.push(`${relativeDocPath(path)}: broken Markdown link ${target}`);
    }
  }
}

for (const path of markdownFiles(designDir)) {
  const name = path.split("/").pop()!;
  const text = readFileSync(path, "utf8");
  if (!/^\*\*Design status:\*\*/m.test(text)) errors.push(`${name}: missing standardized Design status`);
  if (!/^\*\*Implementation status:\*\*/m.test(text)) errors.push(`${name}: missing standardized Implementation status`);
  const accepted = /^\*\*Design status:\*\* Accepted/m.test(text);
  if (accepted && mixedAuthorityHeading.test(text)) {
    errors.push(`${name}: accepted contract contains proposal/migration/open-question heading`);
  }
  if (accepted && text.split("\n").length > 900) {
    errors.push(`${name}: accepted contract exceeds 900 lines; split reference/history from the contract`);
  }
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
  const duplicateHeadings = [...new Set(headings.filter((heading, index) => headings.indexOf(heading) !== index))];
  if (duplicateHeadings.length > 0) {
    errors.push(`${name}: duplicate second-level heading(s): ${duplicateHeadings.join(", ")}`);
  }
  if (!/(tracker|historical)/i.test(text.slice(0, 500)) && /Last verified:[^\n]*\d{4}-\d{2}-\d{2}/i.test(text)) {
    warnings.push(`${name}: replace dated live census with a stable contract or generated evidence link`);
  }
  checkMarkdownLinks(path, text);
}

for (const path of [...markdownFiles(principlesDir), ...markdownFiles(designDir), ...markdownFiles(manualDir)]) {
  const text = readFileSync(path, "utf8");
  for (const contract of staleContractPatterns) {
    if (contract.pattern.test(text)) {
      errors.push(`${relativeDocPath(path)}: ${contract.message}`);
    }
  }
}

const allowedRootEntries = new Set([
  ".agents", ".claude", ".codex", ".copilot", ".git", ".gitignore", ".initialized", ".state",
  "CONVENTIONS.md", "README.md", "agents", "bun.lock", "bunfig.toml", "contracts", "gym",
  "node_modules", "package.json", "packages", "projects", "scripts", "shared", "sources", "tsconfig.json", "ui",
]);
for (const entry of readdirSync(root).sort()) {
  if (!allowedRootEntries.has(entry)) warnings.push(`root layout: unclassified entry ${entry}`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`May design integrity: ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length > 0) process.exitCode = 1;
