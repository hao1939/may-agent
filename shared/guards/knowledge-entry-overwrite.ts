import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * knowledge-entry-overwrite guard — detects risky canonical KE overwrites.
 *
 * Scout/explore sessions recently used whole-file writes against legacy shared
 * knowledge entries (KE-001, KE-002, KE-021), replacing canonical content while
 * claiming they had created new knowledge entries. Low-numbered KE files are
 * established shared memory; new entries should use the current high-numbered
 * namespace, and corrections to legacy entries should be explicit read()+edit()
 * changes rather than blind write()/shell redirection overwrites.
 *
 * This guard warns instead of blocking. Guard signals are evidence for review
 * and follow-up; the workflow remains responsible for judging whether to fix,
 * revert, or escalate.
 */

type ExtractedCall = {
  name: string;
  path?: string;
  command?: string;
};

function extractToolCalls(messages: any[]): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  for (const msg of messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "toolCall" && part.type !== "tool_use") continue;
      const name = part.name ?? part.toolName;
      const args = part.arguments ?? part.input ?? {};
      calls.push({ name, path: args.path, command: args.command });
    }
  }
  return calls;
}

function allSessionCalls(event: WorkflowGuardEvent): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  for (const step of event.completedSteps ?? []) {
    const messages = step.result?.messages;
    calls.push(...extractToolCalls(Array.isArray(messages) ? messages : []));
  }
  const messages = event.result?.messages;
  calls.push(...extractToolCalls(Array.isArray(messages) ? messages : []));
  return calls;
}

function normalizePath(p: string): string {
  return (p || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/app\/agents\//, "")
    .replace(/^\/app\//, "")
    .replace(/^agents\//, "")
    .replace(/^\.\//, "");
}

function legacyKnowledgeEntryFromPath(p: string | undefined): string | null {
  if (!p) return null;
  const normalized = normalizePath(p);
  const match = normalized.match(/^shared\/knowledge\/entries\/(KE-\d{1,3}(?!\d)(?:[-\w]*)?\.md)$/);
  return match ? `shared/knowledge/entries/${match[1]}` : null;
}

function legacyKnowledgeEntriesFromShellWrite(command: string | undefined): string[] {
  if (!command) return [];
  const hits = new Set<string>();
  const patterns = [
    /(?:>|>>)\s*['"]?(?:\/app\/agents\/|\/app\/|agents\/)?(shared\/knowledge\/entries\/KE-\d{1,3}(?!\d)(?:[-\w]*)?\.md)/g,
    /\btee\s+(?:-a\s+)?['"]?(?:\/app\/agents\/|\/app\/|agents\/)?(shared\/knowledge\/entries\/KE-\d{1,3}(?!\d)(?:[-\w]*)?\.md)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
      hits.add(normalizePath(match[1]));
    }
  }

  return [...hits];
}

export const guard: WorkflowGuard = {
  name: "knowledge-entry-overwrite",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];

    const finishResult = event.result?.finishResult;
    if (!finishResult || finishResult.status !== "success") return [];

    const risky = new Set<string>();
    for (const call of allSessionCalls(event)) {
      if (call.name === "write") {
        const legacyPath = legacyKnowledgeEntryFromPath(call.path);
        if (legacyPath) risky.add(legacyPath);
      }
      if (call.name === "bash") {
        for (const legacyPath of legacyKnowledgeEntriesFromShellWrite(call.command)) {
          risky.add(legacyPath);
        }
      }
    }

    if (risky.size === 0) return [];

    return [{
      type: "warn",
      reason:
        `Shared Knowledge Integrity risk: finish(success) followed whole-file writing legacy KE path(s): ` +
        `${[...risky].join(", ")}. Low-numbered KE files are canonical shared memory. ` +
        `If you are adding new knowledge, choose a new unused high-numbered KE id and verify it does not exist. ` +
        `If you are updating an existing KE, read() it first and use edit() with a narrow diff or dated follow-up rather than write()/shell redirection.`,
    }];
  },
};
