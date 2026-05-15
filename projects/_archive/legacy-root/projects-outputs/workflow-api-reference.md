# Shared Workflows — API Reference

> Auto-generated documentation for `/agents/shared/workflows/`
> Generated: 2025-01-27

---

## Table of Contents

1. [budget-checkpoint.ts](#budget-checkpointts) — Auto-checkpoint before budget exhaustion
2. [circuit-breaker.ts](#circuit-breakerts) — Provider error circuit breaker
3. [fewshot-inject-helpers.ts](#fewshot-inject-helpersts) — Few-shot example injection
4. [heartbeat-data.ts](#heartbeat-datats) — Heartbeat data loaders
5. [implement-and-verify.ts](#implement-and-verifyts) — Lightweight code workflow
6. [master-worker.ts](#master-workerts) — Orchestrator + worker loop
7. [project-helpers.ts](#project-helpersts) — Shared project utilities
8. [project.ts](#projectts) — Persistent task loop workflow
9. [verify-wrap.ts](#verify-wrapts) — Simple agent wrapper

---

## budget-checkpoint.ts

**Purpose**: Auto-checkpoint deliverables when approaching the operation budget limit (60 turns). Fires at 80% threshold (48 turns) so work isn't lost if the workflow is killed at the hard limit.

**Constants**:
| Name | Value | Description |
|------|-------|-------------|
| `BLOCK_TURNS` | 60 | Hard turn limit |
| `CHECKPOINT_RATIO` | 0.80 | Checkpoint fires at this fraction |
| `CHECKPOINT_THRESHOLD` | 48 | Computed: `floor(60 * 0.80)` |

### `estimateTurnsUsed(iteration, hasReview): number`

Estimate cumulative turns consumed by iteration count.

| Param | Type | Description |
|-------|------|-------------|
| `iteration` | `number` | Current iteration number |
| `hasReview` | `boolean` | Whether this iteration includes a review step |

**Formula**: `1 + iteration * (1 + (hasReview ? 1 : 0))`

### `shouldBudgetCheckpoint(projectId, iteration, reviewEvery): boolean`

Check if the workflow should auto-checkpoint now. Returns `true` at most once per project run (when estimated turns ≥ 48).

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Unique key for this run (e.g. project directory path) |
| `iteration` | `number` | Current iteration number |
| `reviewEvery` | `number` | Review frequency (used to estimate turns) |

### `buildBudgetCheckpointEntry(iteration, turnsEstimate): string`

Build a markdown journal entry recording the budget checkpoint.

---

## circuit-breaker.ts

**Purpose**: Track consecutive provider errors per agent. After 3+ consecutive errors, the agent's circuit "opens" (disabled). A `SIGNAL-circuit-breaker.md` file is created for human attention. Deleting the signal file manually re-enables the agent.

**Constants**:
| Name | Value | Description |
|------|-------|-------------|
| `THRESHOLD` | 3 | Consecutive errors before tripping |

### `checkCircuitBreaker(agentsRoot, agent): string | null`

Check if an agent's circuit breaker is open.

| Param | Type | Description |
|-------|------|-------------|
| `agentsRoot` | `string` | Path to `agents/` directory |
| `agent` | `string` | Agent name |

**Returns**: `null` if OK to proceed, or a reason string if blocked. Auto-resets if the SIGNAL file was manually deleted.

### `recordOutcome(agentsRoot, agent, isError): void`

Record success or failure after running an agent. Increments consecutive error count or resets to 0.

| Param | Type | Description |
|-------|------|-------------|
| `agentsRoot` | `string` | Path to `agents/` directory |
| `agent` | `string` | Agent name |
| `isError` | `boolean` | Whether the run resulted in an error |

### `resetCircuitBreaker(agentsRoot, agent): void`

Programmatically reset an agent's circuit breaker (alternative to deleting the SIGNAL file).

**State file**: `agents/shared/circuit-breaker-state.json`
**Signal file**: `agents/<agent>/SIGNAL-circuit-breaker.md`

---

## fewshot-inject-helpers.ts

**Purpose**: Keyword-based static router that prepends domain-matched worked examples to coder task messages before LLM calls. Evidence: EXP-084 through EXP-097 (100+ gym runs, 18/18 matched = 100%).

**Constants**:
| Name | Value | Description |
|------|-------|-------------|
| `MAX_EXAMPLES` | 2 | Max examples injected per task |
| `MAX_TOTAL_CHARS` | 12000 | ~3000 tokens character limit |
| `EXAMPLES_DIR` | `agents/shared/knowledge/fewshot-examples` | Example file location |

**Rules** (from KE-065):
- Only inject when task matches domain class (Level 2 minimum)
- Examples go in USER MESSAGE, not system prompt
- Max 2 examples, under ~3000 tokens total
- Bypass with `GYM_NO_FEWSHOT=1` env var

### Domain Patterns

| Pattern | Example File | Matches |
|---------|-------------|---------|
| `binary\|\.bin\|compiled\|executable\|hexdump` | `binary-file-escalation` | Binary file tasks |
| `bug\|error\|failing\|test.*fail\|crash\|500\|exception` | `reproduce-first-debugging` | Debugging tasks |
| `upgrade\|dependency\|multiple.*(file\|module)\|impact` | `escalation-judgment` | Multi-file changes |
| `blocked\|impossible\|can't.*find\|missing.*key` | `know-when-blocked` | Blocked scenarios |
| `fix.*bug\|broken\|failing\|doesn't.*work` | `evidence-over-narrative` | Bug fix tasks |

### `selectExamples(taskContent): string[]`

Select matching example file basenames (max 2). Strips verification command blocks before matching to avoid false positives.

### `loadExample(filename): string | null`

Load a `.md` example file. Extracts the `## Worked Example` section, falling back to full content (minus YAML frontmatter).

### `injectFewShot(task): string`

Main entry point. Selects examples, loads them, and prepends to the task string. Returns the enriched task.

---

## heartbeat-data.ts

**Purpose**: Pure JS functions that pre-load metrics, projects, alerts, inbox, and heartbeat.md for any agent's heartbeat workflow. Zero LLM cost — all data loading happens before the agent session.

### `loadMetrics(ctx, agent): string`

Load active metrics from DB for an agent. Returns formatted string with status indicators (✅/⚠️), consecutive breach detection (escalates at 3+), and diagnostic commands.

### `loadProjects(ctx, agent): string`

Scan `agents/shared/projects/` for active projects owned by the agent. Returns summary lines with status, health, milestone progress, and resume conditions.

### `loadAlerts(ctx, agent): string`

Load unresolved alerts for an agent.

### `loadInbox(ctx, agent): string`

Load pending inbox messages for an agent.

### `loadHeartbeatMd(ctx, agent): string`

Load the agent's `heartbeat.md` file if it exists.

### `formatMetricsBlock(metricsStr): string`

Format raw metrics string into a displayable block.

**Dependencies**: Imports `checkCircuitBreaker` and `recordOutcome` from `circuit-breaker.ts`.

---

## implement-and-verify.ts

**Purpose**: Lightweight code workflow (H-070 P3 experiment). Strips out QA agent, uses shell verification only. Target overhead: ~3-5 ops vs ~9-15 for implement-and-review.

**Workflow Name**: `implement-and-verify`

### Flow

```
1. Coder implements (with verification info in prompt)
2. Run verification command (tsc + vitest) — hard gate, no LLM
3. If verify passes → done
4. If verify fails → ONE retry with error output
5. If retry fails → escalate
```

### Input Format

Plain text coding task. Optional metadata fields:

| Field | Default | Description |
|-------|---------|-------------|
| `verifyCommand:` | `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run` | Shell verification command |
| `maxAttempts:` | `2` | Max implementation attempts |

### Internal Functions

- **`parseInput(raw): ParsedInput`** — Extracts task, verifyCommand, maxAttempts from raw input
- **`runVerify(command): VerifyResult`** — Executes shell verification, returns pass/fail + output

### Design Decisions
- Few-shot injection enabled via `injectFewShot()` from fewshot-inject-helpers
- State approach (`stateApproach`) removed per EXP-050 — added 1.76-3.78x overhead with zero quality improvement (see H-085)

---

## master-worker.ts

**Purpose**: Two persistent sessions (orchestrator + worker) running a review-first → work → review → work loop. The orchestrator assesses state and directs strategy; the worker executes.

**Workflow Name**: `master-worker`

### Project.md Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `**Workflow**` | Yes | — | Must be `master-worker` |
| `**Max Iterations**` | No | 50 | Safety cap |
| `**Status**` | Yes | — | `active/paused/cancelled/blocked/waiting/done` |
| `**Owner**` | Yes | — | Agent name |

### Key Types

```typescript
interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "unknown";
  detail: string;
}
```

### `extractDecision(text): Decision`

Parse orchestrator output into a structured decision. Recognition priority:

1. First line starts with keyword (`CONTINUE`, `PIVOT`, `WAITING`, `BLOCKED`, `DONE`)
2. Pattern match: `Decision: KEYWORD` or `**KEYWORD**`
3. Natural language: "proceed", "move forward", "start working" → `continue`
4. Fallback: scan for uppercase keywords (except DONE — too common)
5. Default: `{ status: "unknown" }`

### Loop Flow

```
For each iteration (up to maxIterations):
  1. Orchestrator reviews state → Decision
  2. If CONTINUE/PIVOT → Worker executes task
  3. If WAITING/BLOCKED/DONE → Stop loop, update project status
  4. If UNKNOWN → Treat as continue (with warning)
```

---

## project-helpers.ts

**Purpose**: Shared utility functions used by both `project.ts` and `master-worker.ts` for parsing and updating project markdown files.

### `extractField(content, field): string`

Extract a `**Field**: value` from markdown content. Returns empty string if not found.

```typescript
extractField(content, "Status")  // → "active"
extractField(content, "Owner")   // → "coach"
```

### `extractSection(content, heading): string`

Extract everything between `## Heading` and the next `## ` (or end of file).

### `extractMilestones(content): MilestoneState`

Parse the `## Plan` (or `## Milestones`) section into structured data.

```typescript
interface MilestoneState {
  total: number;      // total milestone count
  done: number;       // completed count
  pending: string[];  // unchecked milestone texts
  completed: string[];// checked milestone texts
}
```

### `checkOffMilestones(content, reviewerText): string`

Auto-check milestones in project.md based on reviewer output. Recognizes:
- `Milestone completed: "..."` / `✅ "..."`
- `[x] ...` in reviewer text
- `M1: Done`, `M2: Complete` (index-based matching against plan)

### `updateProjectStatus(projectPath, newStatus): void`

Update the `**Status**:` field in a project.md file.

---

## project.ts

**Purpose**: Run a task in a persistent loop until done, blocked, or owner intervenes. The main single-agent project workflow.

**Workflow Name**: `project`

### File Structure

**Directory format** (preferred):
```
<project-dir>/
  project.md   — goal, milestones, state, comments
  journal.md   — iteration log (append-only)
```

**Legacy format**: Single `.md` file for both project and journal.

### Input Format

```
project: agents/shared/projects/my-project
goal: optional override
worker: optional agent name
maxIterations: 5
reviewEvery: 3
```

### Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `project` | *required* | Path to project directory or legacy .md file |
| `goal` | from project.md | Task goal (auto-read from `## Goal` section) |
| `worker` | calling agent | Agent to run as worker |
| `maxIterations` | 5 | Max loop iterations |
| `reviewEvery` | 3 | Reviewer runs every N iterations |

### Loop Flow

```
1. Read project.md → extract status, goal, milestones
2. If status not active → exit
3. For each iteration:
   a. Worker executes with project context
   b. Append iteration result to journal.md
   c. Every reviewEvery iterations: reviewer assesses progress
   d. Auto-check-off milestones from reviewer output
   e. Budget checkpoint if approaching turn limit
4. Update project status on completion
```

### Integration Points
- Uses `budget-checkpoint.ts` for auto-checkpointing
- Uses `project-helpers.ts` for markdown parsing
- Journal is append-only (safe for concurrent reads)

---

## verify-wrap.ts

**Purpose**: Simplest possible workflow — runs a single agent session with the configured task. Used by cron jobs (reflect, optimize, common-sense-verify, research-intake).

**Workflow Name**: `verify-wrap`

### Flow

```
1. Run ctx.runAgent(ctx.agent, ctx.task)
2. If error → escalate
3. If success → summarize and done
```

No loops, no retries, no state management. Pure pass-through.

---

## Architecture Overview

### Dependency Graph

```
project.ts ──────→ project-helpers.ts
                 → budget-checkpoint.ts

master-worker.ts → project-helpers.ts

implement-and-verify.ts → fewshot-inject-helpers.ts

heartbeat-data.ts → circuit-breaker.ts

verify-wrap.ts   → (no internal deps)
```

### Workflow Selection

Workflows are selected by the `**Workflow**:` field in project.md:

| Value | Workflow | Use Case |
|-------|----------|----------|
| `project` | project.ts | Single-agent persistent task loop |
| `master-worker` | master-worker.ts | Two-agent orchestrator + worker |
| `implement-and-verify` | implement-and-verify.ts | Quick code task with shell verification |
| `verify-wrap` | verify-wrap.ts | Cron job single-shot execution |

### Common Patterns

1. **Field-level markdown parsing**: All workflows use `**Field**: value` format parsed by `extractField()`
2. **Append-only journals**: Iteration logs go to `journal.md`, never edited
3. **Status-driven control**: Workflows check `**Status**:` each iteration and stop on `done/blocked/waiting/cancelled`
4. **Budget awareness**: Long-running workflows checkpoint before hitting the 60-turn hard limit
5. **Circuit breaker protection**: `heartbeat-data.ts` checks breaker state before running agents
