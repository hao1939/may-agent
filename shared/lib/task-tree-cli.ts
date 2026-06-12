#!/usr/bin/env bun

/**
 * Task tree CLI — check, status, kanban, next for any project tree.
 *
 * Usage:
 *   bun shared/lib/task-tree-cli.ts check  <tree.json>
 *   bun shared/lib/task-tree-cli.ts status <tree.json>
 *   bun shared/lib/task-tree-cli.ts kanban <tree.json>
 *   bun shared/lib/task-tree-cli.ts next   <tree.json>
 */

import { readFileSync } from "node:fs";
import { check, status, kanban, next, type TaskTree, type Violation } from "./task-tree.ts";

const command = process.argv[2];
const treePath = process.argv[3];

if (!command || !treePath) {
  console.error("Usage: bun task-tree-cli.ts <check|status|kanban|next> <tree.json>");
  process.exit(2);
}

const tree: TaskTree = JSON.parse(readFileSync(treePath, "utf8"));

if (command === "check") {
  const violations = check(tree);
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");
  const hints = violations.filter((v) => v.severity === "hint");

  for (const v of violations) {
    const icon = v.severity === "error" ? "FAIL" : v.severity === "warning" ? "WARN" : "HINT";
    const node = v.nodeId ? ` ${v.nodeId}` : "";
    console.log(`${icon} ${v.code}${node}: ${v.message}`);
  }

  console.log(`\n${errors.length} errors, ${warnings.length} warnings, ${hints.length} hints`);
  if (errors.length) process.exitCode = 1;
} else if (command === "status") {
  const s = status(tree);
  console.log(`\nProject: ${s.project}`);
  console.log(`Updated: ${s.updatedAt}`);
  console.log(`Nodes: ${s.totalNodes} (${s.archivedNodes} archived)`);
  console.log(`\nBy status:`);
  for (const [st, count] of Object.entries(s.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${st}: ${count}`);
  }
  if (s.activeWork.length) console.log(`\nActive: ${s.activeWork.join(", ")}`);
  if (s.blockedWork.length) console.log(`Blocked: ${s.blockedWork.join(", ")}`);
  if (s.reviewWork.length) console.log(`Review: ${s.reviewWork.join(", ")}`);
  if (s.nextReady.length) console.log(`Ready: ${s.nextReady.join(", ")}`);
  for (const h of s.rollupHints) {
    console.log(`Hint: ${h.nodeId} — ${h.hint}: ${h.detail}`);
  }
} else if (command === "kanban") {
  const cards = kanban(tree);
  const lanes: Record<string, typeof cards> = {};
  for (const card of cards) {
    if (!lanes[card.lane]) lanes[card.lane] = [];
    lanes[card.lane].push(card);
  }
  const order = ["backlog", "in-progress", "review", "blocked", "done", "archive"];
  for (const lane of order) {
    const items = lanes[lane] || [];
    if (!items.length) continue;
    console.log(`\n── ${lane.toUpperCase()} (${items.length}) ──`);
    for (const card of items) {
      const badges = card.badges.length ? ` [${card.badges.join(", ")}]` : "";
      console.log(`  ${card.nodeId}: ${card.goal.slice(0, 70)}${badges}`);
    }
  }
} else if (command === "next") {
  const ready = next(tree);
  if (!ready.length) {
    console.log("No runnable tasks.");
  } else {
    console.log(`${ready.length} runnable task(s):\n`);
    for (const node of ready) {
      console.log(`  ${node.id}: ${node.goal.slice(0, 70)}`);
    }
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(2);
}
