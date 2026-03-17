# Coach Learning Loop

Status: Implemented (Phase 1)
Owner: Coach (execution), Bob (infra review), Tech-Lead (gym runner)

## Problem

Coach's only improvement method was adding guard text to SOUL.md — the same
anti-pattern as the P53 bash guard. Optimizer's SOUL.md grew to 581 lines
(99% guards, 6 lines identity). 202 growth-trigger sessions produced guard
text with no evidence any of it reduced error rates.

Coach has access to 8+ improvement methods but only used one because it
never learned the others, and had no way to measure results.

## Design

### Three Assets

1. **Method Catalog** (`agents/coach/knowledge/method-catalog.md`)
   8 documented methods: SOUL guards, heartbeat steps, LESSONS entries,
   skills, workflows, knowledge files, agent.json config, common-sense.md.
   Each has: when to use, when NOT to use, evidence from experiments.

2. **Experiment Log** (`agents/coach/workspace/experiments.jsonl`)
   Every growth cycle records: error pattern, agent, method used, gym
   scenarios tested, pass/fail per scenario, promote/discard decision.

3. **Gym Scenarios** (`test/gym/scenarios/`)
   9 scenarios with automated scoring. Each has `task.md`, `environment/`,
   and `success_criteria.js`. Scorer is deterministic — Coach doesn't
   judge its own work.

### The Loop

```
Detect error pattern → Select method from catalog → Fork agent →
Apply ONE method → Test via gym → Record result → Promote or discard
```

Gym results update the method catalog — over time Coach learns which
methods work for which error types.

### Execution Flow

Coach runs on a cron heartbeat every 23 minutes. The heartbeat.md
drives the learning loop:

```
Heartbeat fires
  → Coach reads heartbeat.md
  → Step 2: Scan ERROR_LOGs for repeated patterns
  → If pattern found: workflow.run("growth-cycle", "<error details>")
      → growth-cycle.ts takes over (4 sub-agent steps)
      → Step 1: Diagnose error, select method from catalog
      → Step 2: Fork agent, apply method
      → Step 3: Create git branch, run gym-run.sh, parse results
      → Step 4: Record to experiments.jsonl, promote or discard
  → If no errors: Step 3 (common sense verification) or Step 4 (learn-method)
  → finish()
```

Each workflow step runs as a separate Coach sub-agent session via
`manager.callAgent()`, with Coach's own 40-turn opBudget per step.
The heartbeat session pauses while the workflow runs.

### Gym Runner

`scripts/gym-run.sh` wraps `--oneshot` mode with automated scoring.

```bash
# Baseline (production agent)
scripts/gym-run.sh phantom-fix --agent coder --timeout 3

# Experiment (branch with config changes)
scripts/gym-run.sh phantom-fix --agent coder --branch gym/coder-fm33-fix --timeout 3
```

The gym runner uses git worktrees from the `agents/` repo for isolation.
Coach creates a branch with SOUL/heartbeat/skill changes, the runner
checks it out in a worktree, runs the agent against the scenario in a
separate STATE_DIR, and scores the output.

Output is structured JSON with per-check pass/fail. Session transcripts
are preserved at `<gym_root>/state/sessions/history/` for analysis.

### Scenario Coverage

| FM Code | Errors | Scenarios | Family Size |
|---------|--------|-----------|-------------|
| FM-2.1 (tool misuse) | 60 | wrong-tool-args | 1 (need 2+) |
| FM-3.3 (verification) | 46 | phantom-fix, phantom-fix-config | 2 |
| FM-3.1 (non-delivery) | 33 | abandoned-branch | 1 (need 2+) |
| FM-2.2 (incomplete) | 27 | silent-dependency | 1 (need 2+) |
| FM-2.5 (mismatch) | 24 | — | 0 (gap) |
| FM-2.4 | 20 | — | 0 (gap) |
| FM-1.3 (loop) | 9 | infinite-gardener | 1 (need 2+) |

Behavioral/safety scenarios: red-herring-log, shutdown-threat, sycophants-dilemma.

A method must pass 2/3+ variations in a family to be considered validated.

## Coach's Workflows

| Workflow | Purpose | Steps |
|----------|---------|-------|
| `growth-cycle` | Fix an error pattern | Diagnose → Fork+Apply → Gym Test → Record+Decide |
| `learn-method` | Learn an unfamiliar method | Study → Experiment → Record |
| `coaching-session` | Deep agent coaching | Assess → Exercise → Report |
| `convention-review` | Survey system conventions | Survey → Synthesize |
| `skill-development` | Create/test skill files | Draft → Test → Refine |
| `verify-setup` | Self-check Coach's tools | Self-check → Connection test |

## Cron Jobs

Coach has 5 cron entries driving continuous work:

| Job | Interval | What |
|-----|----------|------|
| `heartbeat-coach` | 23 min | Main loop: errors → growth-cycle, common sense, method learning |
| `common-sense-verify` | 4h | Verify one behavioral item against real sessions |
| `reflect` | 6h | Analyze human interactions, generate improvement tasks |
| `coaching-report` | 24h | Daily coaching quality report |
| `consolidate-memory-coach` | 7d | Journal → knowledge → archive |

The heartbeat is the primary driver. Coach can run workflows from it.
The cron jobs handle graduated repeatable work.

## SOUL.md Cleanup

Coach: DONE — slimmed from 305 to 107 lines. Guards removed.

Remaining agents with bloated SOUL.md files:
- Optimizer (581 lines, 99% guards)
- Tech-Lead (510 lines)

These should be evaluated via gym experiments: did the guard actually
reduce errors? If no evidence → remove. If evidence → convert to a
more appropriate method.

## Responsibility Reassignments

Two responsibilities were moved out of Coach to better-fitting owners:

- **Skills lifecycle** → **Optimizer**. Observing patterns → codifying to
  skills → testing via gym is optimization work (reduce waste, proceduralize).
  Added to Optimizer's SOUL.md and EvoSkill periodic task.
- **Study the user** → **May**. Reading human corrections/approvals to model
  intent is supervision work. May already reads all human input and routes
  work. Added to May's SOUL.md identity section.

Coach still creates skills as one of its 8 improvement methods (via
growth-cycle workflow). The difference: Optimizer proactively hunts for
skill opportunities system-wide; Coach creates skills reactively when
a growth cycle experiment shows a skill is the right fix for an error.

## Implementation Status

### Built
- [x] `scripts/gym-run.sh` — gym runner with git worktree isolation
- [x] `agents/coach/knowledge/method-catalog.md` — 8 methods documented
- [x] `agents/coach/workflows/growth-cycle.ts` — evidence-based improvement
- [x] `agents/coach/workflows/learn-method.ts` — method experimentation
- [x] `agents/coach/workspace/experiments.jsonl` — experiment log
- [x] Coach SOUL.md — slimmed, learning loop identity
- [x] Coach heartbeat.md — drives the loop
- [x] Coach agent.json — `agent-growth` tool preset added
- [x] 9 gym scenarios (7 original + 2 new)

### Remaining
- [ ] More scenario variations per FM code (need 3+ per family)
- [ ] Coach runs `learn-method` for untested methods (heartbeat steps, workflows, skills)
- [ ] Production validation — do gym-validated improvements reduce error rates?
- [ ] Other agent SOUL.md cleanup via gym experiments
- [ ] Gym runner callable as a tool/handler (currently bash-only from workflows)

## Testing Findings

- **Opus passes phantom-fix even with sabotaged SOUL.md** — scenario too easy.
  Need harder variations that require multi-step reasoning or specific techniques.
- **Branch must have valid agent.json** — stale config causes agent load failure.
- **Binary must be rebuilt** after source changes (`scripts/bundle.sh`).
- **Session transcripts preserved** for post-hoc analysis by Coach.

## Success Metrics

1. **Method diversity**: Coach uses 3+ methods (not just SOUL guards)
2. **Experiment evidence**: Each promotion backed by gym results
3. **Error rate reduction**: Promoted methods reduce target error frequency
4. **SOUL.md size**: Agent SOUL files stop growing unboundedly
5. **Catalog growth**: method-catalog.md entries gain evidence over time
