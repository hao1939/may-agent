# Issue Lifecycle Workflow — Feasibility Report

**Date**: 2026-04-16
**Author**: tech-lead

## 1. Workflow System Capabilities

The workflow runtime (`src/lib/workflow.ts`) provides:

| Capability | Supported? | Details |
|---|---|---|
| Sequential agent steps | ✅ | `ctx.runAgent(name, task)` — run any agent, get TaskResult |
| Conditional branching | ✅ | Workflows are plain TypeScript — any `if/else` logic works |
| State persistence across steps | ✅ | Persistent-task pattern: markdown file IS the state. Also `ctx.runFunction()` for pure JS state manipulation |
| Resume after failure | ✅ | Persistent-task detects pending reviews (crash recovery §4.5). State in file survives crashes |
| Sub-workflows | ✅ | `ctx.runWorkflow(name, task)` — full composition support |
| Guards/hooks | ✅ | WorkflowGuard system: inject steps, block, warn on events |
| Rich handoff | ✅ | `ctx.summarize(result)` builds structured context from TaskResult |

**Key constraint**: Workflows run within a single top-level session. If the session dies, the workflow must be re-invoked. Persistent-task solves this by writing all state to a markdown file, so re-invocation resumes where it left off.

## 2. Requests Table as Issue Tracker

The `requests` table schema:

```
requestId, parentRequestId, fromEntity, toAgent, method, task, status,
sessionId, source, createdAt, updatedAt, completedAt, durationMs,
summary, error, errorClass, retryable, artifact, context, expectations, notify
```

**What works for issues:**
- `task` → issue description
- `status` (CREATED/IN_PROGRESS/COMPLETED/FAILED/BLOCKED) → covers basic lifecycle
- `parentRequestId` → links sub-tasks to parent issue
- `fromEntity`/`toAgent` → discoverer and assignee
- `error`/`errorClass` → resolution info
- `artifact` → can link to files (findings, patches)

**What's missing for a full issue tracker:**
- **Severity/priority** — no field (currently tracked in message text as P0/P1/P2)
- **Category/type** — no field (bug, perf, design debt, etc.)
- **Stage/phase** — status is too coarse. Need: `INVESTIGATING | DESIGNING | IMPLEMENTING | VERIFYING | RESOLVED`
- **Linked sessions** — `sessionId` is singular; an issue may span many sessions across stages
- **Resolution field** — `summary` could serve, but there's no dedicated `resolution` or `rootCause`
- **Duplicate detection** — no mechanism to link duplicates

**Verdict**: Requests can serve as the backbone with 2-3 added columns (priority, category, stage). Alternatively, use the existing fields creatively: encode stage in status, priority in context field. Adding columns is cleaner.

## 3. Recommended Architecture

### Option A: Extend persistent-task pattern (RECOMMENDED)
The persistent-task workflow already solves the hard problems: state persistence, crash recovery, owner/worker handoff, iteration pruning. Issue-lifecycle is structurally similar:

```
persistent-task:  worker → review → worker → review → done
issue-lifecycle:  investigate → design → review → implement → verify → done
```

**Implementation**: A new workflow (`issue-lifecycle`) that:
1. Uses a markdown file as state (like persistent-task)
2. Has named **phases** instead of numbered iterations
3. Each phase runs a different agent via `ctx.runAgent()`
4. Phase transitions are conditional (investigation may → skip design, go straight to implement)
5. A request record tracks the overall issue; phase transitions update it

```
Phase 1: INVESTIGATE  — tech-lead or qa examines the issue
Phase 2: DESIGN       — tech-lead writes a fix approach (skip if trivial)
Phase 3: REVIEW       — bob or tech-lead reviews the design (skip if trivial)
Phase 4: IMPLEMENT    — coder implements via implement-and-verify sub-workflow
Phase 5: VERIFY       — qa verifies the fix
```

Each phase writes its output to the issue markdown file. If any phase fails or blocks, the workflow escalates with full context.

### Option B: Chain existing workflows
Compose `parallel-research` → `implement-and-verify` → `verify-wrap`. Simpler but less flexible — no unified state file, harder to resume mid-pipeline.

### Option C: New first-class system
Build a dedicated issue tracker with its own table, UI, state machine. Most powerful but highest cost. Not justified yet.

**Recommendation**: Option A. It reuses battle-tested primitives (persistent-task's state management, workflow composition, request tracking) while adding the multi-agent phase structure that issue-lifecycle needs.

## 4. Key Risks & Blockers

| Risk | Severity | Mitigation |
|---|---|---|
| **Cost explosion** — LLM calls at every phase for every issue | HIGH | Gate: only issues above severity threshold enter the workflow. Trivial issues get auto-resolved or stay as requests |
| **Agent quality at investigation** | MEDIUM | Investigation prompt must be highly structured. Bad investigation → bad fix. Include mandatory sections (repro, root cause, affected code) |
| **Phase skip logic complexity** | LOW | Keep it simple: only skip design+review for issues tagged "trivial". Default is full pipeline |
| **No severity field in requests** | LOW | Add a `priority` column, or encode in context field. Small migration |
| **Workflow session timeout** | MEDIUM | If a 5-phase workflow takes >30min, the session may time out. Persistent-task's file-based state solves this — re-invoke picks up at last phase |
| **Discovery integration** | LOW | QA and tech-lead already discover issues in heartbeats and write findings. Need a thin adapter: finding → request → workflow trigger |

## 5. Discovery Mechanisms (Current State)

**QA** (`agents/qa/heartbeat.md`): Scans unreviewed commits, does code quality sweeps. Writes findings to `workspace/journal.md`. Notifies tech-lead via `agents.message`.

**Tech-lead** (`agents/tech-lead/heartbeat.md`): Runs system-level audits through rotating lenses (architecture, flow complexity, fragility, etc.). Writes findings to `workspace/research/`. Can fork coder for fixes.

**Gap**: Findings are scattered across journal entries and research files. No structured pipeline from "found issue" → "tracked" → "fixed" → "verified". The issue-lifecycle workflow would close this gap.
