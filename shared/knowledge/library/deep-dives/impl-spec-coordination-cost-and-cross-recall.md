# Implementation Specification: Coordination Cost Tracking + Cross-Agent Active Recall

**Date:** 2026-03-15  
**Author:** Scout  
**Source:** CR#130 (Research-Practice Bridge) — Priorities #2 and #3  
**Type:** Engineering specification — ready for implementation  
**Effort Total:** ~150-200 LoC across 2 features

---

## Feature 1: Coordination Cost Tracking (Priority #2)

### Problem Statement

The system tracks `productive_calls` and `wasted_calls` per agent (via `evaluator.ts` + `evaluator-failure-chain.ts`), and `UsageSummary` tracks total token usage. But there's no concept of **coordination cost** — the overhead of reading/writing shared state, handoffs, and SIGNALS.md.

**Research basis:** CR#117 (Communication Thermodynamics), DD#251 (Carnot Bound) — 55% of multi-agent bandwidth is wasted on coordination overhead. Systems that don't measure this can't optimize it.

**Current state:** The evaluator knows `totalTokens` and `turns` but can't distinguish:
- Tokens spent on *the actual task* (reading files, writing code, running tests)
- Tokens spent on *coordination* (reading SIGNALS.md, processing handoff summaries, reading other agents' workspace files)

### Design: Lightweight Extraction, No New Infrastructure

Rather than instrumenting every tool call at runtime (high effort, invasive), we extract coordination cost **post-hoc from the existing message transcript** during evaluation — the same approach already used for `FailureChain` extraction.

### New File: `src/lib/coordination-cost.ts` (~80-100 LoC)

```typescript
/**
 * coordination-cost.ts — Coordination Cost Extraction
 *
 * Analyzes a completed session transcript to estimate the fraction
 * of tool calls and tokens spent on inter-agent coordination vs. task work.
 *
 * Research basis: CR#117 (Communication Thermodynamics), DD#251 (Carnot Bound)
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Types ──────────────────────────────────────────────────────────────

export interface CoordinationCost {
  /** Total tool calls in the session. */
  totalCalls: number;
  /** Tool calls classified as coordination overhead. */
  coordinationCalls: number;
  /** Tool calls classified as task work. */
  taskCalls: number;
  /** Coordination ratio: coordinationCalls / totalCalls (0.0 - 1.0). */
  coordinationRatio: number;
  /** Whether the session exceeds the Carnot Bound (ratio > 0.30). */
  exceedsCarnot: boolean;
  /** Breakdown by coordination type. */
  breakdown: {
    signalsReads: number;    // reads of SIGNALS.md or shared bulletin
    handoffWrites: number;   // writes to SIGNALS.md / handoff calls
    crossAgentReads: number; // reads of other agents' workspace files
    heartbeatReads: number;  // reads of own heartbeat.md (startup overhead)
  };
}

// ── Classification Patterns ────────────────────────────────────────────

/** Patterns that indicate coordination overhead (not task work). */
const COORDINATION_PATTERNS = {
  signalsRead: [
    /read.*SIGNALS\.md/i,
    /read.*bulletin\.md/i,
    /cat.*SIGNALS\.md/i,
    /cat.*bulletin\.md/i,
  ],
  handoffWrite: [
    /handoff/i,                         // handoff tool calls
    /write.*SIGNALS\.md/i,
    /echo.*>>.*SIGNALS\.md/i,
  ],
  crossAgentRead: [
    /read.*agents\/(?!.*heartbeat\.md)/i,  // reading other agents' files (not heartbeat)
    /cat.*agents\/(?!.*heartbeat\.md)/i,
    /ls.*agents\//i,
    /find.*agents\//i,
  ],
  heartbeatRead: [
    /read.*heartbeat\.md/i,
    /cat.*heartbeat\.md/i,
  ],
} as const;

// ── Core Extraction ────────────────────────────────────────────────────

/**
 * Extract coordination cost from a completed session transcript.
 *
 * Classifies each tool call as coordination or task work by matching
 * tool name + arguments against known coordination patterns.
 *
 * @param messages - The session's message array.
 * @param agentName - The agent's own name (for distinguishing own vs. other agent files).
 * @returns Coordination cost breakdown.
 */
export function extractCoordinationCost(
  messages: AgentMessage[],
  agentName: string,
): CoordinationCost {
  const breakdown = {
    signalsReads: 0,
    handoffWrites: 0,
    crossAgentReads: 0,
    heartbeatReads: 0,
  };

  let totalCalls = 0;
  let coordinationCalls = 0;

  for (const msg of messages) {
    if (!("role" in msg) || msg.role !== "assistant") continue;
    const content = (msg as any).content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type !== "toolCall") continue;
      totalCalls++;

      const toolName = block.name ?? "";
      const argsStr = JSON.stringify(block.args ?? {});
      const combined = `${toolName} ${argsStr}`;

      let isCoordination = false;

      // Check each pattern category
      for (const pattern of COORDINATION_PATTERNS.signalsRead) {
        if (pattern.test(combined)) {
          breakdown.signalsReads++;
          isCoordination = true;
          break;
        }
      }
      if (!isCoordination) {
        for (const pattern of COORDINATION_PATTERNS.handoffWrite) {
          if (pattern.test(combined)) {
            breakdown.handoffWrites++;
            isCoordination = true;
            break;
          }
        }
      }
      if (!isCoordination) {
        for (const pattern of COORDINATION_PATTERNS.crossAgentRead) {
          if (pattern.test(combined)) {
            breakdown.crossAgentReads++;
            isCoordination = true;
            break;
          }
        }
      }
      if (!isCoordination) {
        for (const pattern of COORDINATION_PATTERNS.heartbeatRead) {
          if (pattern.test(combined)) {
            breakdown.heartbeatReads++;
            isCoordination = true;
            break;
          }
        }
      }

      if (isCoordination) coordinationCalls++;
    }
  }

  const coordinationRatio = totalCalls > 0 ? coordinationCalls / totalCalls : 0;

  return {
    totalCalls,
    coordinationCalls,
    taskCalls: totalCalls - coordinationCalls,
    coordinationRatio,
    exceedsCarnot: coordinationRatio > 0.30,
    breakdown,
  };
}

/**
 * Format coordination cost as a brief summary string for evaluation output.
 */
export function formatCoordinationCost(cost: CoordinationCost): string {
  const pct = (cost.coordinationRatio * 100).toFixed(0);
  const warning = cost.exceedsCarnot ? " ⚠️ EXCEEDS CARNOT BOUND" : "";
  return `Coordination: ${cost.coordinationCalls}/${cost.totalCalls} calls (${pct}%)${warning}`;
}
```

### Integration Point: `evaluator.ts`

Add coordination cost to `TaskEvaluationResult`:

```typescript
// In TaskEvaluationResult interface (line ~44):
/** Per-agent coordination cost analysis. */
coordinationCosts?: Record<string, CoordinationCost>;

// In evaluateTask() function (line ~295), after extracting failure chains:
import { extractCoordinationCost } from "./coordination-cost.js";

// For each child session, extract coordination cost:
const coordinationCosts: Record<string, CoordinationCost> = {};
for (const child of children) {
  coordinationCosts[child.agent] = extractCoordinationCost(
    child.messages,
    child.agent,
  );
}
// Add to result object
result.coordinationCosts = coordinationCosts;
```

### Output Format

In evaluation JSON output, adds:
```json
{
  "coordinationCosts": {
    "scout": {
      "totalCalls": 45,
      "coordinationCalls": 8,
      "taskCalls": 37,
      "coordinationRatio": 0.178,
      "exceedsCarnot": false,
      "breakdown": {
        "signalsReads": 2,
        "handoffWrites": 1,
        "crossAgentReads": 3,
        "heartbeatReads": 2
      }
    }
  }
}
```

### Monitoring: When to Act

- `coordinationRatio > 0.30` → Warning: past Carnot Bound. The agent is spending more time coordinating than working.
- `coordinationRatio > 0.50` → Critical: the agent should either receive a simpler task or the coordination protocol should be simplified.
- Track over time: if the team-average ratio is trending upward, the system is scaling poorly.

---

## Feature 2: Cross-Agent Active Recall (Priority #3)

### Problem Statement

Currently, `active-recall.ts` reads only the target agent's own `ERROR_LOG.jsonl`. If Agent A fails on a task pattern, and Agent B is assigned a similar task, B receives **no warning**.

**Research basis:** DD#96 (Experience Learning), CR#117 (Communication Thermodynamics) — cross-agent failure propagation reduces total system failure rates, but must be bandwidth-bounded.

**Current flow:**
```
manager.ts:406 → runActiveRecall(agentName, projectRoot)
                 → reads agents/{agentName}/ERROR_LOG.jsonl
                 → returns warnings for THIS AGENT ONLY
```

### Design: Bounded Cross-Agent Recall

Key constraints:
1. **Must not bloat context** — the whole point of active recall is concise, relevant warnings
2. **Must be fast** — recall runs before every task dispatch
3. **Must prioritize relevance** — Agent A's network errors are irrelevant to Agent B's file editing

Strategy: Read all agents' error logs, but apply a **relevance filter** — only surface failures that match the *task type* being assigned. Use error codes (FM-X.Y) as the matching key, since the same failure mode (e.g., FM-2.6 "blind filesystem search") can happen to any agent.

### Modified Function: `runActiveRecall()` in `active-recall.ts`

Add a new parameter and companion function (~40-50 additional LoC):

```typescript
/**
 * Run cross-agent active recall: check OTHER agents' error logs
 * for failure patterns relevant to the current task.
 *
 * Only surfaces failures that share FM-X.Y codes with the target agent's
 * own failures, or that match common high-risk patterns.
 *
 * @param agentName - The agent being dispatched (excluded from cross-recall).
 * @param projectRoot - Project root.
 * @param maxCrossWarnings - Maximum cross-agent warnings to inject. Default: 3.
 * @returns Additional warnings from other agents' experiences.
 */
export function runCrossAgentRecall(
  agentName: string,
  projectRoot: string,
  maxCrossWarnings: number = 3,
): ActiveRecallResult {
  const agentsDir = join(projectRoot, "agents");

  // Discover all agent directories
  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== agentName && d.name !== "shared")
      .map((d) => d.name);
  } catch {
    return { triggered: false, matchCount: 0, failureTypes: [], warnings: [] };
  }

  const crossWarnings: string[] = [];
  const crossFailureTypes: Set<string> = new Set();
  let totalMatches = 0;

  // High-risk FM codes that are relevant across all agents
  const UNIVERSAL_CODES = new Set([
    "FM-2.6",  // blind filesystem search
    "FM-4.2",  // hallucinated file paths
    "FM-5.1",  // infinite loop / repetition
    "FM-3.1",  // ignored tool output
    "FM-6.1",  // constraint violation
  ]);

  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  for (const otherAgent of agentDirs) {
    if (crossWarnings.length >= maxCrossWarnings) break;

    const errorLogPath = join(agentsDir, otherAgent, "ERROR_LOG.jsonl");
    if (!existsSync(errorLogPath)) continue;

    try {
      const content = readFileSync(errorLogPath, "utf-8");
      const lines = content.split("\n").filter((l: string) => l.trim());
      const tailLines = lines.slice(-50); // smaller window for cross-recall

      for (const line of tailLines) {
        if (crossWarnings.length >= maxCrossWarnings) break;
        try {
          const entry = JSON.parse(line);

          // Time filter
          if (entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (ts < threeDaysAgo) continue;
          }

          // Relevance filter: only universal high-risk codes
          const code = entry.failure_type || entry.error_code || "";
          if (!UNIVERSAL_CODES.has(code)) continue;

          totalMatches++;
          crossFailureTypes.add(code);
          crossWarnings.push(
            `⚠️ CROSS-RECALL [${otherAgent}]: Failed due to ${code}. ${entry.correction || entry.critique || "Check carefully."}`
          );
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // skip unreadable logs
    }
  }

  return {
    triggered: crossWarnings.length > 0,
    matchCount: totalMatches,
    failureTypes: [...crossFailureTypes],
    warnings: crossWarnings,
  };
}
```

### Required Import Addition

Add to `active-recall.ts` imports:
```typescript
import { readdirSync } from "node:fs";
```

### Integration Point: `manager.ts` (line ~406)

```typescript
// After existing active recall (line 407-409):
const recall = runActiveRecall(agentName, this._projectRoot);
const recallBlock = formatRecallWarnings(recall);

// NEW: Cross-agent recall
import { runCrossAgentRecall } from "./active-recall.js";
const crossRecall = runCrossAgentRecall(agentName, this._projectRoot);
const crossRecallBlock = crossRecall.triggered
  ? formatRecallWarnings({
      ...crossRecall,
      warnings: crossRecall.warnings.map(w =>
        w.replace("⚠️ RECALL:", "⚠️ TEAM-RECALL:")
      ),
    })
  : null;

// Inject both (own recall first, cross-recall second)
if (recallBlock) ctxLines.push(``, recallBlock);
if (crossRecallBlock) ctxLines.push(``, crossRecallBlock);
```

### Context Budget

- Own recall: unlimited warnings (already bounded by 3-day window + 100-entry cap)
- Cross recall: capped at 3 warnings maximum
- Estimated context cost: ~200-400 tokens when triggered (rare — only high-risk universal codes)
- No context cost when not triggered (most sessions)

---

## Feature 3: Coordination Cost + Evaluation Warning (Bonus Integration, ~20 LoC)

If coordination cost exceeds the Carnot Bound, the evaluator should flag it as an issue:

```typescript
// In evaluateTask(), after computing coordinationCosts:
for (const [agent, cost] of Object.entries(coordinationCosts)) {
  if (cost.exceedsCarnot && result.agents[agent]) {
    result.agents[agent].issues.push(
      `[FM-7.1][COORDINATION_OVERHEAD] Agent spent ${(cost.coordinationRatio * 100).toFixed(0)}% of tool calls on coordination (${cost.coordinationCalls}/${cost.totalCalls}). Carnot Bound is 30%.`
    );
  }
}
```

This flows naturally through the existing pipeline:
- `evaluator.ts` → adds FM-7.1 issue
- `evaluator-error-log.ts` → extracts FM-7.1 and writes to ERROR_LOG.jsonl
- `active-recall.ts` → surfaces FM-7.1 warning before next task
- **NEW** `runCrossAgentRecall()` → can surface FM-7.1 to other agents (add to UNIVERSAL_CODES)

This creates a **closed loop**: coordination overhead is measured → flagged → logged → recalled → prevented.

---

## Summary

| Feature | New LoC | Modified Files | Risk |
|---------|---------|---------------|------|
| Coordination Cost Extraction | ~80-100 | New: `coordination-cost.ts` | None — additive |
| Coordination Cost Integration | ~15 | `evaluator.ts` | Low — adds optional field |
| Cross-Agent Active Recall | ~40-50 | `active-recall.ts` | Low — bounded, best-effort |
| Cross-Agent Integration | ~10 | `manager.ts` | Low — extends existing pattern |
| Carnot Warning Loop | ~20 | `evaluator.ts` | None — uses existing issue pipeline |
| **Total** | **~165-195** | **4 files** | **Low** |

### Dependencies
- Feature 1 (impl-spec-evaluator-growth-loop.md) — independent, can be implemented in any order
- No external dependencies — uses only Node.js built-ins already imported

### Testing Strategy
1. **Unit test `extractCoordinationCost()`** with synthetic message arrays containing known tool call patterns
2. **Unit test `runCrossAgentRecall()`** by creating temporary ERROR_LOG.jsonl files with known entries
3. **Integration test**: Run a full session, verify coordination cost appears in evaluation output
4. **Regression check**: Verify existing evaluations still parse correctly (new fields are optional)

### Expected Impact
- **Coordination cost**: Makes invisible overhead visible. First step toward optimizing team communication.
- **Cross-agent recall**: Reduces redundant failures where multiple agents hit the same trap. Expected 10-20% reduction in repeat failures across agents.
- **Carnot warning loop**: Creates the first self-correcting coordination mechanism — the system will naturally learn to minimize coordination overhead.

---

*Research basis: 263 deep-dives, 130 cross-references. Implementation grounded in direct code analysis of `src/lib/evaluator.ts`, `src/lib/active-recall.ts`, `src/lib/handoff.ts`, `src/lib/evaluator-error-log.ts`, and `src/lib/manager.ts`.*
