# Project: Gym Leverage (Orchestrator-Worker)

**Status**: active
**Owner**: bob
**Type**: milestone
**Workflow**: master-worker
**Priority**: P1
**Iteration**: 0
**Health**: —

## Goal
Make the gym a practical tool for accelerating agent evolution. Explore the existing 431 scenarios, fix any issues with the runner, understand what the scenarios test, and design a feedback loop where gym results drive agent improvement.

## Milestones

### Phase 1: Explore & Fix
- [ ] Run the gym runner against 3 diverse scenarios and document results (what passed, what failed, what errored)
- [ ] Fix any runner issues found (import paths, missing deps, adapter problems)
- [ ] Write .state/gym-architecture.md documenting the runner → adapter → scenario → scorer pipeline

### Phase 2: Scenario Review
- [ ] Write .state/gym-categories.md categorizing all 431 scenarios by type with counts
- [ ] Select a "core 20" benchmark suite, document selection rationale in .state/gym-core20.md
- [ ] Run core 20 suite and record baseline scores in .state/gym-baseline.md

### Phase 3: Gym-Driven Evolution
- [ ] Design the feedback loop in .state/gym-evolution-process.md
- [ ] Run one cycle: pick worst category, write/improve a skill, measure improvement
- [ ] Document results of the cycle in .state/gym-cycle-1-results.md

## Resources
- Gym README: agents/gym/README.md
- Gym runner: test/gym/gym-runner.ts
- Scenarios: agents/gym/scenarios/ (431 scenarios)
- Gym triage: agents/gym/TRIAGE.md

## Current State
Phase 1 complete, Phase 2 complete. Phase 3 in progress.
- [x] `.state/gym-architecture.md` — documents runner → adapter → scenario → scorer pipeline
- [x] `.state/gym-categories.md` — 424 scenarios categorized by type and tier
- [x] `.state/gym-core20.md` — core 20 benchmark selected (20 smoke-tier scenarios)
- [x] `.state/gym-baseline.md` — **Core 20 baseline: 8/20 (40%)** (2026-04-26)
  - Strengths: Bug-fixing 3/3, Integrity 1/1
  - Weaknesses: Verification 0/2, Optimizer Workflow 0/2, Judgment 1/4
  - Pattern: Agent succeeds at concrete fix tasks, fails at meta-cognitive tasks
- [x] `.state/gym-evolution-process.md` — feedback loop designed (2026-06-28)
- [x] `.state/gym-cycle-1-results.md` — Cycle 1 complete: scorer bug fix + live agent runs. Optimizer Workflow 2/14→13/14. (2026-06-28)
- **NEXT**: Re-run full Core 20 with live agent for accurate baseline. Then Cycle 2 targeting Judgment (1/4) or Verification (0/2).
- **BLOCKER (2026-04-27)**: `may-agent --oneshot --agent amy --task-file <path>` ignores the task file and runs the agent's heartbeat prompt instead. Gym transcript shows amy-kimi browsing XHS instead of doing the gym task. The `--task-file` / `--work-dir` flags aren't being honored by the runtime. Need infra fix to make gym runs produce valid results.

## Process Notes

## Comments
### 2026-04-27
Attempted Core 20 re-baseline. Discovered gym runner blocker: `may-agent --oneshot --task-file` doesn't inject the task content — agent receives its standard heartbeat prompt instead. All gym runs with live agent are unreliable until this is fixed. The Cycle 1 results (Optimizer Workflow 13/14) may have been from a different runtime version or execution mode. Escalating to tech-lead.
