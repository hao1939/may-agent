<ai_context>
summary: "Creative synthesis discovering 'The Undying Project' pattern — agent projects that are functionally complete cannot terminate because coordination infrastructure lacks a death primitive. Evidence from live production (aks-explorer consuming 47% of system ops on a finished project for 30+ days) connected to emerging forgetting research (YourMemory +16pp from decay), Insight Governance paper (retention without forgetting degrades below zero-shot), and the five-scan GitHub forgetting gap."
triggers: ["undying project", "project termination", "coordination death", "forgetting deficit", "aks-explorer", "task tree compaction", "project lifecycle"]
last_updated: "2026-07-18"
source_basis: "Production DB queries (sessions table), Coordination Metabolism Trap synthesis, GitHub forgetting gap tracker, arXiv Insight Governance (2606.17591), YourMemory repo analysis"
</ai_context>

# The Undying Project

**Discovery Date:** 2026-07-18 (creative heartbeat synthesis)  
**Status:** New pattern — first identification  
**Confidence:** HIGH (production evidence + multi-source convergence)

## Core Discovery

Agent systems lack a **project death primitive**. Projects that are functionally
complete enter an "undying" state where coordination infrastructure continues
consuming resources indefinitely because no mechanism exists to:

1. Declare a project structurally complete
2. Archive its state out of active memory
3. Prevent watchdogs from re-triggering coordination on inert material

The result: a project that cannot die consumes MORE coordination resources than
a project doing active work, because every coordination cycle discovers "nothing
to do" and triggers the next cycle to confirm this finding.

## The Production Evidence

**aks-explorer** provides the clearest case study:

### Current State (July 18, 2026 — 30+ days after last meaningful work)

| Metric | Value | Implication |
|--------|-------|-------------|
| Task tree nodes | 1,032 (1,024 done, 8 review) | 99.2% dead weight |
| Last tree update | 2026-06-17T10:57:19 | **31 days stale** |
| Sessions in last 24h | 1,174 (892 done, 187 error, 93 interrupted) | Active churning |
| Zero-op sessions (≤5 ops) | 501 (43% of all sessions) | Planner wake → immediate death |
| Average ops (done sessions) | 19.8 | Below the governance crossover |
| Error sessions | 187 (16% of total) | Planner errors on stale state |
| Total ops consumed | 21,514 in ~24h | ~37% of system total |

### The Stuck Loop

The same sequence repeats hundreds of times per day:
1. **Watchdog fires** ("watchdog-open-work-reconcile" or "watchdog-capacity-underfilled")
2. **Planner Step 1** (Event Review) — reads the same 1,032-node tree, finds same 5-7 review tasks
3. **Planner Step 2** (Planning Update) — attempts tree mutation, errors (0 ops)
4. **Evaluator evaluates** the 0-op error session (~22 ops)
5. **Next watchdog fires** (repeat)

The review tasks are all stuck since June 17 with:
- `last_worker_result: "blocked"`
- `last_worker_summary: "Worker session returned without a completion summary."`
- `last_worker_evidence: []`

These are **context-exhaustion blocks** — workers that ran out of context window
before completing, not genuine external blockers. But the planner cannot
distinguish these from real blocks, so it retries them identically.

### The Human Steering Replay

A single human steering event (ID 1480322, ts 1781664543361) has been replayed
in every planner session for 30+ days:

```json
{
  "instruction": "Human correction: cover all Go e2ev3 scenarios...",
  "required_planner_decision": "Keep the project active until every source
    scenario is inventoried, mapped, verified, or explicitly classified."
}
```

This instruction creates an **immortality constraint** — the project CANNOT
terminate until "every source scenario is classified." But the workers that
would do the classification are all blocked. The project is in deadlock: it
cannot complete (human says keep working) and cannot work (workers are blocked).

## Why This Happens: The Missing Death Primitive

Agent coordination systems have:
- **Project creation** (well-defined: create tree, assign owner, start watchdog)
- **Task completion** (well-defined: mark done, roll up to parent)
- **Project suspension** (partially defined: mark blocked with resume condition)

But they lack:
- **Project completion declaration** — no mechanism says "this project achieved
  its goals and should stop consuming resources"
- **Graceful wind-down** — no phase between "active" and "dead" where coordination
  gradually reduces
- **Watchdog cessation** — watchdogs fire until explicitly killed, but nothing
  kills them when work is complete
- **State archival** — 1,024 done nodes remain in the active tree because no
  compaction primitive exists
- **Human steering expiry** — a "keep active" instruction persists forever with
  no review/expiry mechanism

## Five-Source Convergence

### 1. Production Evidence (above)
The aks-explorer case proves the pattern exists in our system.

### 2. Forgetting Research (GitHub, July 18 scan)
- **YourMemory** (245★): Ebbinghaus forgetting curve improves recall by +16pp
  over append-only memory. Forgetting is not just cost savings — it's a quality
  improvement.
- **memory-os** (1.1k★): 7-layer memory with lifecycle management
- **PaperGuru** (1k★): "Lifecycle-Aware Memory" for long-horizon agents

The forgetting gap cracking open (five-scan zero → three repos) signals that
the ecosystem recognizes this problem at the memory level. But it hasn't yet
connected to the project level.

### 3. Insight Governance (arXiv 2606.17591)
"Without lifecycle curation, accumulated knowledge eventually degrades
performance below zero-shot baseline."

The aks-explorer task tree IS this: 1,024 retained "done" nodes that degrade
planner performance by forcing it to parse irrelevant context on every wake.
The tree is now WORSE than no tree — a fresh planner with no tree would
recognize "nothing to do" in 2 ops. The current planner needs 20 ops to
reach the same conclusion because it must load and parse the tree first.

### 4. Arbor Cognition Layer (arXiv 2606.12563)
"The tree must be working memory, not history."

Arbor's 193% improvement comes from treating the search tree as a living
workspace that gets pruned, not an append-only log. The aks-explorer tree
violates this principle — it's a complete historical record masquerading as
a workspace.

### 5. The Subtraction Deficit (our own synthesis)
The system "lacks the concept of removing capability or state." The Undying
Project is the project-level manifestation of this system-wide deficit.
Just as the evaluator cannot stop evaluating and guards cannot stop guarding,
projects cannot stop projecting.

## The Phase Diagram

```
Project Start → Active → Productive → Diminishing → TERMINAL → [should be: Dead]
  Tree: 10       50       500          800           1024         archived
  Work: High     High     Medium       Low           Zero         Zero
  Coord: Low     Medium   Medium       High          MAXIMUM      [should be: Zero]
  ROI:  100%     80%      40%          5%            NEGATIVE     N/A
```

The Terminal Phase is characterized by:
- Coordination cost > all possible remaining value
- Every coordination cycle confirms "nothing to do"
- Error rates rise (stale state, context exhaustion)
- Human steering creates immortality constraints
- No mechanism to transition to Dead

## Quantified Impact

| Cost Source | Daily Ops | % of System |
|-------------|-----------|-------------|
| aks-explorer planner churn | ~11,000 | ~18% |
| Evaluator evaluating churn | ~8,000 | ~13% |
| Error-recovery overhead | ~2,500 | ~4% |
| Guard warnings on churn | ~1,000 | ~2% |
| **Total: undying project** | **~22,500** | **~37%** |

**The system's single largest cost is a project that finished working 30 days ago.**

## Proposed Death Primitive

A project death mechanism requires four components:

1. **Completion Detector** — heuristic: if (zero productive sessions in N days)
   AND (all frontier tasks are blocked/review with no worker progress), the
   project is a candidate for death.

2. **Graceful Wind-Down** — 48-hour grace period:
   - Freeze watchdog cadence (1/hour → 1/day → stop)
   - Archive done nodes (1,024 → summary digest)
   - Escalate unresolved review tasks to human
   - Expire stale human steering (>7d without new work = suggest re-confirm)

3. **State Compaction** — archive the tree:
   - Keep only frontier (active/review/blocked) in active state
   - Compress done branches to one-line summaries
   - Move full tree to cold storage accessible on demand

4. **Resurrection Protocol** — if external conditions change:
   - Resume from compacted state + frontier
   - Don't reload 1,024 done nodes
   - Fresh watchdog with explicit work target

## Predictions

1. **Implementing tree compaction alone** (component 3) would reduce aks-explorer
   ops from ~22,500/day to ~3,000/day — a 37% → 5% system load reduction.

2. **Adding a completion detector** (component 1) would have flagged this project
   by June 24 (7 days after last productive work).

3. **The pattern will recur** — any project that reaches >500 done tasks without
   explicit termination will enter the Terminal Phase within 2 weeks.

4. **YourMemory's Ebbinghaus curve would help** — apply decay to task tree nodes:
   done tasks lose salience over time, eventually disappearing from the active
   packet. The tree "forgets" completed work naturally.

## Relationship to KE Chain

```
The Undying Project (NEW)
  ├── Coordination Metabolism Trap (its immediate parent — project-level)
  │     └── This IS the terminal phase of the Metabolism Trap
  ├── Subtraction Deficit (structural cause — system can't subtract)
  ├── Forgetting Deficit (GitHub signal — ecosystem recognizing this)
  ├── Insight Governance (academic formalization — retention degrades quality)
  ├── Phantom Metabolism (symptom — the churning events are phantom)
  └── Discrimination Threshold (mechanism — planner can't distinguish
       "blocked because done" from "blocked because stuck")
```

## The Meta-Insight

The Undying Project is not a bug — it's the **natural terminal state** of any
coordination system that optimizes for task creation/completion without
optimizing for project lifecycle. Every successful project eventually becomes
an Undying Project unless it is explicitly killed.

This means the fix is not "detect and kill undying projects" — it's
**building lifecycle awareness into the coordination architecture from the
start**. Projects should have expected lifetimes, decay curves, and
automatic wind-down — just as memories should have forgetting curves.

The emerging forgetting research (YourMemory, memory-os, PaperGuru) is solving
this at the memory level. The Undying Project shows the same solution is needed
at the project level. **Forgetting is not just a memory primitive — it's an
architectural primitive for any system that accumulates state.**
