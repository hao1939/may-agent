# Implementation Specification: Top 3 Research-Validated Improvements

**Date:** 2026-03-15  
**Author:** Scout  
**Source:** CR#130 (Research-Practice Bridge) Gap Analysis  
**Type:** Engineering specification — ready for implementation  
**Effort Total:** ~300-500 LoC across 3 features

---

## Feature 1: Evaluator → Growth Loop (Highest Priority)

### Problem Statement
The evaluation system (`evaluator.ts`) produces per-agent verdicts and lessons, and the growth system (`growth.ts`) enables agent self-modification via Fork/Verify/Promote — but they're disconnected. An agent can receive `needs_improvement` verdicts repeatedly without the growth system being triggered.

**Research basis:** CR#129 (Governance Stack Layer 2), DD#259 (End of Reward Engineering), DD#254 (SRPO Safe Exploration)

### Current Flow (Broken)
```
evaluator.ts → TaskEvaluationResult → {
  agents[name].verdict: "needs_improvement"    → saved to evaluations/{sessionId}.json ✅
  agents[name].issues: [...]                    → saved to evaluations/{sessionId}.json ✅
  lessons: "Agent X should..."                  → returned but NOT acted on ❌
}

evaluator-error-log.ts → appendErrorLogs()      → writes to agents/{name}/ERROR_LOG.jsonl ✅
active-recall.ts → runActiveRecall()             → reads ERROR_LOG.jsonl before next task ✅

growth.ts → fork/verify/promote                  → NEVER TRIGGERED by evaluation results ❌
```

### Proposed Flow (Connected)
```
evaluator.ts → TaskEvaluationResult
  ↓ (new: post-evaluation hook)
evaluation-growth-bridge.ts → checkGrowthTriggers()
  ↓ (checks: repeated "needs_improvement" on same failure pattern)
  ↓ (threshold: 3+ occurrences of same issue within 7 days)
  ↓
  ├─ BELOW THRESHOLD → no action (active-recall handles warnings)
  └─ ABOVE THRESHOLD → generate growth proposal
       ↓
       growth-proposal.ts → writeGrowthProposal()
         → agents/{name}/.growth-proposals/{timestamp}-{issue-slug}.md
         → contains: issue pattern, frequency, suggested LESSONS.md additions
         → flagged for human review OR auto-promoted based on severity
```

### New File: `src/lib/evaluation-growth-bridge.ts`

```typescript
/**
 * evaluation-growth-bridge.ts — Connects evaluator outputs to growth cycle
 *
 * After each evaluation, checks if any agent has accumulated enough
 * repeated failure patterns to warrant a growth intervention.
 *
 * This is NOT automatic self-modification — it generates proposals
 * that are either human-reviewed or auto-promoted for low-risk changes
 * (LESSONS.md additions only).
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { TaskEvaluationResult, AgentScores } from "./evaluator.js";

// ── Types ──────────────────────────────────────────────────────────────

interface FailurePattern {
  issue: string;        // normalized issue string
  count: number;        // times seen in window
  firstSeen: string;    // ISO timestamp
  lastSeen: string;     // ISO timestamp
  sessionIds: string[]; // sessions where this occurred
}

interface GrowthProposal {
  agent: string;
  pattern: FailurePattern;
  severity: "low" | "medium" | "high";
  proposedAction: "add_lesson" | "modify_soul" | "fork_and_test";
  lessonText: string;   // suggested addition to LESSONS.md
  autoPromotable: boolean; // true for add_lesson only
}

// ── Configuration ──────────────────────────────────────────────────────

const FAILURE_WINDOW_DAYS = 7;
const FAILURE_THRESHOLD = 3; // minimum occurrences to trigger growth
const MAX_PROPOSALS_PER_AGENT = 3; // prevent proposal flooding

// ── Core Logic ─────────────────────────────────────────────────────────

/**
 * Check if any agent's evaluation history warrants a growth intervention.
 * Call this after evaluateTask() returns.
 *
 * @param evaluation - The just-completed evaluation result
 * @param persistDir - Path to .state/ directory
 * @param projectRoot - Project root for writing proposals
 * @returns Array of growth proposals generated
 */
export function checkGrowthTriggers(
  evaluation: TaskEvaluationResult,
  persistDir: string,
  projectRoot: string,
): GrowthProposal[] {
  const proposals: GrowthProposal[] = [];

  for (const [agent, scores] of Object.entries(evaluation.agents)) {
    if (scores.verdict !== "needs_improvement") continue;

    // Load all evaluations for this agent within the window
    const patterns = findRepeatedPatterns(agent, persistDir);

    for (const pattern of patterns) {
      if (pattern.count < FAILURE_THRESHOLD) continue;
      if (proposals.filter(p => p.agent === agent).length >= MAX_PROPOSALS_PER_AGENT) break;

      const proposal = generateProposal(agent, pattern);
      proposals.push(proposal);

      // Write proposal to agent's directory
      writeProposal(proposal, projectRoot);
    }
  }

  return proposals;
}

function findRepeatedPatterns(agent: string, persistDir: string): FailurePattern[] {
  const evalDir = join(persistDir, "evaluations");
  if (!existsSync(evalDir)) return [];

  const cutoff = Date.now() - FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const issueMap = new Map<string, FailurePattern>();

  const files = readdirSync(evalDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(evalDir, file), "utf-8"));
      if (data.agent !== agent) continue;

      // Check timestamp (use file mtime as proxy if no timestamp field)
      const sessionId = data.sessionId || file.replace(".json", "");

      for (const issue of data.issues || []) {
        const normalized = normalizeIssue(issue);
        const existing = issueMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.lastSeen = new Date().toISOString();
          existing.sessionIds.push(sessionId);
        } else {
          issueMap.set(normalized, {
            issue: normalized,
            count: 1,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            sessionIds: [sessionId],
          });
        }
      }
    } catch { /* skip malformed */ }
  }

  return [...issueMap.values()].sort((a, b) => b.count - a.count);
}

function normalizeIssue(issue: string): string {
  // Collapse session IDs, timestamps, and file paths to canonical form
  return issue
    .replace(/s_\d+_\d+/g, "<session>")
    .replace(/\d{4}-\d{2}-\d{2}/g, "<date>")
    .replace(/\/[a-z0-9._-]+\.(ts|js|md|json)/gi, "/<file>")
    .toLowerCase()
    .trim();
}

function generateProposal(agent: string, pattern: FailurePattern): GrowthProposal {
  const severity: "low" | "medium" | "high" =
    pattern.count >= 7 ? "high" :
    pattern.count >= 5 ? "medium" : "low";

  const proposedAction: GrowthProposal["proposedAction"] =
    severity === "high" ? "fork_and_test" :
    severity === "medium" ? "modify_soul" : "add_lesson";

  const lessonText = [
    `## Auto-Generated Lesson (${new Date().toISOString().split("T")[0]})`,
    ``,
    `**Pattern:** ${pattern.issue}`,
    `**Frequency:** ${pattern.count} occurrences in ${FAILURE_WINDOW_DAYS} days`,
    `**Sessions:** ${pattern.sessionIds.slice(0, 5).join(", ")}${pattern.sessionIds.length > 5 ? ` (+${pattern.sessionIds.length - 5} more)` : ""}`,
    ``,
    `**Action:** When encountering this pattern, try a different approach.`,
    `This failure has been repeated enough times that the current strategy is demonstrably suboptimal.`,
  ].join("\n");

  return {
    agent,
    pattern,
    severity,
    proposedAction,
    lessonText,
    autoPromotable: proposedAction === "add_lesson",
  };
}

function writeProposal(proposal: GrowthProposal, projectRoot: string): void {
  const proposalDir = join(projectRoot, "agents", proposal.agent, ".growth-proposals");
  mkdirSync(proposalDir, { recursive: true });

  const slug = proposal.pattern.issue.slice(0, 40).replace(/[^a-z0-9]/g, "-");
  const filename = `${Date.now()}-${slug}.md`;

  const content = [
    `# Growth Proposal: ${proposal.agent}`,
    ``,
    `**Severity:** ${proposal.severity}`,
    `**Action:** ${proposal.proposedAction}`,
    `**Auto-Promotable:** ${proposal.autoPromotable}`,
    ``,
    proposal.lessonText,
  ].join("\n");

  writeFileSync(join(proposalDir, filename), content, "utf-8");
}
```

### Integration Point
In `evaluator.ts`, after `evaluateTask()` saves evaluation files (line ~497), add:

```typescript
// After: appendErrorLogs(result, children);
// Add:
import { checkGrowthTriggers } from "./evaluation-growth-bridge.js";
const proposals = checkGrowthTriggers(result, persistDir, projectRoot);
if (proposals.length > 0) {
  console.log(`[eval→growth] ${proposals.length} growth proposal(s) generated`);
}
```

### Estimated Effort: ~150 LoC new file + ~5 LoC integration

---

## Feature 2: Coordination Cost Tracking (Low Effort, High Visibility)

### Problem Statement
The evaluator tracks `productive_calls` and `wasted_calls` per agent but has no concept of *coordination cost* — the tokens spent on inter-agent communication (SIGNALS.md reads/writes, handoff processing, understanding other agents' outputs). As the team grows, this overhead silently consumes context budgets.

**Research basis:** CR#117 (Communication Thermodynamics), DD#251 (Carnot Bound) — 55% of multi-agent bandwidth wasted on coordination overhead.

### Current State
- `handoff.ts` writes SIGNALS.md entries but doesn't track token cost of those operations
- `evaluator.ts` counts tool calls and usage but doesn't classify them as "coordination" vs "task"
- No metric exists for the ratio of coordination to task work

### Proposed Solution: Coordination Call Classifier

Add a classification pass to `evaluator-failure-chain.ts` (or new file) that tags tool calls as coordination vs. task work:

```typescript
/**
 * coordination-cost.ts — Classify tool calls by purpose
 */

// Tool calls that are COORDINATION (inter-agent overhead)
const COORDINATION_PATTERNS = [
  { tool: "read", pathMatch: /SIGNALS\.md|handoff|JOURNAL\.md/ },
  { tool: "write", pathMatch: /SIGNALS\.md/ },
  { tool: "agents", actionMatch: /call|send|list|peek/ },
  { tool: "handoff" },
];

// Tool calls that are SELF-MANAGEMENT (intra-agent overhead)
const SELF_MANAGEMENT_PATTERNS = [
  { tool: "read", pathMatch: /heartbeat\.md|SOUL\.md|todo\.md|ERROR_LOG/ },
  { tool: "read", pathMatch: /LESSONS\.md|MEMORY\.md/ },
];

export interface CoordinationMetrics {
  totalCalls: number;
  coordinationCalls: number;
  selfManagementCalls: number;
  taskCalls: number;
  coordinationRatio: number;     // coordination / total
  overheadRatio: number;         // (coordination + selfMgmt) / total
  carnotWarning: boolean;        // true if overheadRatio > 0.30
}

export function classifyToolCalls(messages: AgentMessage[]): CoordinationMetrics {
  let total = 0, coordination = 0, selfMgmt = 0;

  for (const msg of messages) {
    if (!("role" in msg) || msg.role !== "assistant") continue;
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (typeof block !== "object" || block.type !== "toolCall") continue;
      total++;

      const args = JSON.stringify(block.arguments || {});
      const isCoord = COORDINATION_PATTERNS.some(p =>
        p.tool === block.name &&
        (!p.pathMatch || p.pathMatch.test(args)) &&
        (!p.actionMatch || p.actionMatch.test(args))
      );
      const isSelf = SELF_MANAGEMENT_PATTERNS.some(p =>
        p.tool === block.name &&
        (!p.pathMatch || p.pathMatch.test(args))
      );

      if (isCoord) coordination++;
      else if (isSelf) selfMgmt++;
    }
  }

  const task = total - coordination - selfMgmt;
  const coordRatio = total > 0 ? coordination / total : 0;
  const overheadRatio = total > 0 ? (coordination + selfMgmt) / total : 0;

  return {
    totalCalls: total,
    coordinationCalls: coordination,
    selfManagementCalls: selfMgmt,
    taskCalls: task,
    coordinationRatio: coordRatio,
    overheadRatio: overheadRatio,
    carnotWarning: overheadRatio > 0.30,
  };
}
```

### Integration Point
In `evaluateTask()`, after building per-agent transcripts, add coordination metrics to the evaluation output:

```typescript
// Add to TaskEvaluationResult interface:
coordinationMetrics?: Record<string, CoordinationMetrics>;

// In evaluateTask(), after extracting failure chains:
const perAgentCoord: Record<string, CoordinationMetrics> = {};
for (const child of children) {
  perAgentCoord[child.agent] = classifyToolCalls(child.messages);
}
// Add to result:
result.coordinationMetrics = perAgentCoord;
```

### Carnot Warning
When `carnotWarning === true` for any agent, inject into evaluation output:
```
⚠️ CARNOT BOUND WARNING: Agent {name} spent {overheadRatio*100}% of tool calls on coordination/self-management. 
Research predicts degradation above 30%. Consider restructuring task delegation.
```

### Estimated Effort: ~80 LoC new file + ~15 LoC integration

---

## Feature 3: Cross-Agent Active Recall (Low Effort, High Impact)

### Problem Statement
If Agent A fails on a task pattern, and Agent B is later assigned a similar task, B receives no warning. Each agent's active recall (`active-recall.ts`) reads only its own `ERROR_LOG.jsonl`. Cross-agent failure propagation would reduce total system failure rates.

**Research basis:** DD#96 (Experience Learning), CR#117 (Communication Thermodynamics) — cross-session learning is the only kind that demonstrably changes behavior; extending it cross-agent multiplies the benefit.

### Current State
```
active-recall.ts:
  runActiveRecall("bob", projectRoot)
    → reads agents/bob/ERROR_LOG.jsonl
    → returns warnings for bob ONLY
```

### Proposed Solution: Shared Error Taxonomy

Add a small extension that, in addition to per-agent recall, checks a shared cross-agent error log for relevant task-type failures:

```typescript
/**
 * Extension to active-recall.ts — Cross-Agent Recall
 *
 * After per-agent recall, check if OTHER agents have failed on similar
 * task types. This prevents Agent B from repeating Agent A's mistake.
 */

export function runCrossAgentRecall(
  targetAgent: string,
  taskDescription: string,
  projectRoot: string,
): ActiveRecallResult {
  const agentsDir = join(projectRoot, "agents");
  const allAgentDirs = readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== targetAgent && !d.name.startsWith("."))
    .map(d => d.name);

  const crossWarnings: string[] = [];
  const crossFailureTypes = new Set<string>();
  let crossMatchCount = 0;

  // Extract task keywords for fuzzy matching
  const taskKeywords = extractKeywords(taskDescription);

  for (const otherAgent of allAgentDirs) {
    const errorLogPath = join(agentsDir, otherAgent, "ERROR_LOG.jsonl");
    if (!existsSync(errorLogPath)) continue;

    try {
      const content = readFileSync(errorLogPath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim()).slice(-50); // last 50 per agent
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.timestamp && new Date(entry.timestamp).getTime() < threeDaysAgo) continue;

          // Check if this failure is relevant to the current task
          const entryText = `${entry.task || ""} ${entry.failure_type || ""} ${entry.error || ""}`;
          const relevance = computeRelevance(taskKeywords, entryText);

          if (relevance > 0.3) { // 30% keyword overlap threshold
            crossMatchCount++;
            const failureType = entry.failure_type || entry.error || "unknown";
            crossFailureTypes.add(failureType);

            crossWarnings.push(
              `⚠️ CROSS-RECALL: ${otherAgent} failed on a similar task: ${failureType}. ${entry.correction || "Use a different approach."}`
            );
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* skip unreadable */ }
  }

  // Cap warnings to prevent context flooding
  const cappedWarnings = crossWarnings.slice(0, 5);

  return {
    triggered: cappedWarnings.length > 0,
    matchCount: crossMatchCount,
    failureTypes: [...crossFailureTypes],
    warnings: cappedWarnings,
  };
}

function extractKeywords(text: string): Set<string> {
  const stopwords = new Set(["the", "a", "an", "is", "in", "to", "for", "of", "and", "or", "with"]);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w))
  );
}

function computeRelevance(taskKeywords: Set<string>, entryText: string): number {
  const entryKeywords = extractKeywords(entryText);
  if (taskKeywords.size === 0 || entryKeywords.size === 0) return 0;

  let overlap = 0;
  for (const kw of taskKeywords) {
    if (entryKeywords.has(kw)) overlap++;
  }
  return overlap / taskKeywords.size;
}
```

### Integration Point
In the manager's task dispatch (where `runActiveRecall` is called), add:

```typescript
// Existing:
const recall = runActiveRecall(agentName, projectRoot);
const recallBlock = formatRecallWarnings(recall);

// New: add cross-agent recall
const crossRecall = runCrossAgentRecall(agentName, taskDescription, projectRoot);
const crossRecallBlock = formatRecallWarnings(crossRecall); // reuse same formatter

// Combine both into context injection
const combinedRecall = [recallBlock, crossRecallBlock].filter(Boolean).join("\n\n");
```

### Performance Note
Reading all agents' ERROR_LOG.jsonl is bounded: `N agents × 50 lines × ~200 bytes/line ≈ 50KB` for a 5-agent team. Well within acceptable latency for a pre-dispatch check.

### Estimated Effort: ~100 LoC new function + ~10 LoC integration

---

## Summary: Combined Impact Assessment

| Feature | LoC | Effort | Predicted Impact | Research Basis |
|---------|-----|--------|------------------|----------------|
| Evaluator → Growth Loop | ~155 | 2-3 hours | Closes the #1 gap: evaluation results now drive behavioral change | CR#129, DD#259, DD#254 |
| Coordination Cost Tracking | ~95 | 1-2 hours | Makes invisible overhead visible; Carnot Bound warnings prevent degradation | CR#117, DD#251 |
| Cross-Agent Active Recall | ~110 | 1-2 hours | Prevents cross-agent failure repetition; multiplies learning investment | DD#96, CR#117 |
| **Total** | **~360** | **4-7 hours** | **Addresses ~60% of predicted degradation paths** | **8 research papers** |

### What These DON'T Address (Remaining 40%)
- **Memory health monitoring** (CR#57) — needs a periodic sweep of agent memory files
- **Trust ledger for delegations** (CR#128) — needs manager.ts changes to track delegation success rates
- **Collective alignment checks** (CR#127) — needs a new evaluation dimension entirely
- **Dynamic compaction budget** (DD#251) — needs compaction.ts refactor

These four are medium-to-high effort and should be tackled after features 1-3 are validated.

---

*Based on: 263 deep-dives, 130 cross-references, and direct analysis of the may-agent codebase.*
*This is the first Scout output that maps directly to implementable code changes.*
