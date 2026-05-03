/**
 * project-helpers.ts — Shared utility functions for project workflows.
 */
import { readFileSync, writeFileSync } from "node:fs";

export function extractField(content: string, field: string): string {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Canonical project fields use bold labels, e.g. "**Status**: active".
  const boldMatch = content.match(new RegExp(`^\\*\\*${escapedField}\\*\\*:\\s*(.+)`, "mi"));
  if (boldMatch) return boldMatch[1].trim();

  // Some legacy project files used heading labels, e.g. "## Status: Complete".
  // Treat these as fields too so closed/completed projects are skipped instead
  // of being re-dispatched into zombie master-worker loops.
  const headingMatch = content.match(new RegExp(`^#{1,6}\\s+${escapedField}\\s*:\\s*(.+)`, "mi"));
  return headingMatch ? headingMatch[1].trim() : "";
}

export function extractSection(content: string, heading: string): string {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^##\\s+${heading}`, "i").test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n").trim();
}

export interface MilestoneState {
  total: number;
  done: number;
  pending: string[];
  completed: string[];
}

export function extractMilestones(content: string): MilestoneState {
  const section = extractSection(content, "Plan");
  // Also try "Milestones" for backward compatibility
  const fallback = section || extractSection(content, "Milestones");
  const lines = fallback.split("\n").filter(l => /^\s*-\s*\[/.test(l));
  const completed = lines.filter(l => /\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, "").trim());
  const pending = lines.filter(l => /\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/i, "").trim());
  return { total: lines.length, done: completed.length, pending, completed };
}

export function checkOffMilestones(content: string, reviewerText: string): string {
  const completedKeys: string[] = [];
  const completionPatterns = [
    /(?:milestone completed|completed milestone|milestone done|done)[:\s]+["']?(.+?)["']?$/gim,
    /✅\s*["']?(.+?)["']?$/gm,
    /\[x\]\s*(.+)$/gm,
    /\*\*M\d+[:\s]+Done/gim,  // "**M1: Done" — extract milestone by matching against plan
  ];
  // Also match "M1: Done", "M2: Complete" etc by number → milestone index
  const indexPatterns = [...reviewerText.matchAll(/\bM(\d+)[:\s]*(?:done|complete|finished|verified)/gim)];
  if (indexPatterns.length > 0) {
    // Get milestone texts by index from content
    const planLines = content.split("\n").filter(l => /^\s*-\s*\[/.test(l));
    for (const m of indexPatterns) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < planLines.length) {
        const text = planLines[idx].replace(/^\s*-\s*\[[ x]\]\s*/i, "").trim();
        completedKeys.push(text.slice(0, 30).toLowerCase());
      }
    }
  }
  for (const pat of completionPatterns) {
    for (const m of reviewerText.matchAll(pat)) {
      completedKeys.push(m[1].trim().slice(0, 30).toLowerCase());
    }
  }
  if (completedKeys.length === 0) return content;
  const lines = content.split("\n");
  let inPlan = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*(Plan|Milestones)/i.test(lines[i])) { inPlan = true; continue; }
    if (inPlan && /^##\s/.test(lines[i])) break;
    if (!inPlan) continue;
    const m = lines[i].match(/^(\s*-\s*)\[ \]\s*(.+)/i);
    if (m) {
      const key = m[2].trim().slice(0, 30).toLowerCase();
      if (completedKeys.some(ck => key.startsWith(ck) || ck.startsWith(key))) {
        lines[i] = lines[i].replace("[ ]", "[x]");
      }
    }
  }
  return lines.join("\n");
}

export function extractComments(content: string): string {
  return extractSection(content, "Comments");
}

export function clearComments(content: string): string {
  const lines = content.split("\n");
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Comments/i.test(lines[i])) { start = i + 1; }
    if (start > 0 && i > start && /^## /.test(lines[i])) { end = i; break; }
  }
  if (start === -1) return content;
  return [...lines.slice(0, start), "", ...lines.slice(end)].join("\n");
}

export function updateProjectStatus(file: string, status: string, stopReason?: string, iteration?: number): void {
  let content = readFileSync(file, "utf-8");
  content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
  if (stopReason) {
    if (/^\*\*Stop Reason\*\*:/m.test(content)) {
      content = content.replace(/^\*\*Stop Reason\*\*:.*$/m, `**Stop Reason**: ${stopReason}`);
    } else {
      content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}\n**Stop Reason**: ${stopReason}`);
    }
  }
  if (iteration !== undefined) {
    content = content.replace(/^\*\*Iteration\*\*:.*$/m, `**Iteration**: ${iteration}`);
  }
  writeFileSync(file, content, "utf-8");
}
