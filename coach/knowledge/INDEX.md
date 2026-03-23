# Knowledge Context

## Team
Coach trains agents (Opus). Bob is Architect (Gemini).
May is Supervisor (Opus). Evaluator scores (GPT-5.2).
Scout researches (Opus). Optimizer makes agents cheaper/more robust.

## Core Loop
- **Growth Cycle**: Fork → Train → Gym Test → Promote/Discard.
- **Method Catalog**: 18+ methods with evidence status. Consult before acting.
- **Gym Runner**: `test/gym/gym-runner.ts` — automated scoring, `--lab` for forks, `--tier` for filtering.
- **Training Sprint**: Batch 3-5 experiments when you have multiple targets.
- **🏆 Workflow Enforcement (#15)**: 20/20 (100%) across 4 scenarios. Skip text methods — go directly to workflow enforcement or infra guards for behavioral fixes.
- **Text coaching is closed**: 0/18 total (0/13 judgment + 0/5 procedural). C39 is the sole exception. Don't waste experiments on SOUL/LESSONS/heartbeat text for behavioral patterns.

## Key Files
- `knowledge/method-catalog.md` — improvement methods with evidence
- `knowledge/growth-cycle.md` — the fork-train-test skill
- `knowledge/library/research-notes.md` — Scout research synthesis mapped to coaching practice
- `workspace/experiments.jsonl` — all experiment results
- `agents/shared/common-sense.md` — behavioral items you co-own with Bob

## Agent Growth Tools
- `fork_agent` → creates `agents/.lab/<fork>/`
- `promote_agent` → copies fork config to production agent
- `discard_agent` → cleans up failed experiments
- Gym: `bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork> --timeout 3`

## MAST Failure Codes
Use standardized codes from `agents/shared/knowledge/mast-taxonomy.md`:
- **FM codes** (what): FM-1.x Repetitive, FM-2.x Tool Misuse,
  FM-3.x Premature Termination, FM-4.x Lazy/Shortcut, FM-5.x Wrong Sequence
- **FC codes** (why): FC-1 Planning, FC-2 Goal Misalignment,
  FC-3 Context Loss, FC-4 Knowledge Gap, FC-5 Error Non-Recovery
- Use FM+FC pairs: `[FM-1.3 / FC-5.1] Looping because agent didn't read error`

## Project Layout
- `agents/*/SOUL.md` — agent identity
- `agents/*/LESSONS.md` — accumulated learnings
- `agents/*/knowledge/` — agent context
- `agents/.lab/` — experimental forks
- `agents/gym/scenarios/` — gym scenarios with automated scorers

## Key Skills
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  tool grounding (only call tools that exist — no fork_agent/verify_agent),
  retry loop, validation. Anti-patterns: reasoning-action mismatch (FM-2.6,
  11 occurrences in your sessions — fabrication, substitution, requirement drift).
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on. Use this when coaching agents on FM-2.2 (dead-end
  non-recovery) — the fallback ladders are the teachable intervention.
- `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn budget
  upfront, create deliverable skeletons early, checkpoint at 50%/75% marks.
  Targets FM-3.1 (premature termination) — 31 occurrences across all agents.
  Use when coaching agents who explore without producing deliverables: the
  50% checkpoint and deliverable-first steps are the key interventions.
- `agents/shared/skills/delegation-verification/SKILL.md` — verify delegated
  work is registered before closing your session. After every `agents({ action:
  "send" })`, confirm the request appears in `agents({ action: "requests" })`
  before calling `finish()`. 73% of delegations are fire-and-forget. You
  delegate behavioral patches to May (3/3 unverified) — this skill ensures
  your patches actually land with a SEND → RECORD → VERIFY → DOCUMENT pattern.
- `agents/shared/skills/idempotent-work-detection/SKILL.md` — before starting
  any task, check if the work is already done. Quick state check in turn 1,
  decide in turn 2. Prevents 3-8 wasted turns per incident.
- `agents/shared/skills/evidence-over-narrative/SKILL.md` — when narrative
  cues (intuitive beliefs, task descriptions) conflict with runtime evidence
  (experiment results, method catalog data), trust the evidence. Your method
  catalog shows 0/18 text experiments improved behavior, yet text-based methods
  still get evaluated before defaulting to workflow enforcement. Apply evidence-
  first: check method-catalog.md results BEFORE designing an intervention.
  When evidence says a method class doesn't work, skip it — don't re-evaluate.
  Use this skill when coaching agents on phantom-fix patterns (FM-2.6).
- `agents/shared/skills/incremental-context-loading/SKILL.md` — gate context
  file reads on change detection before loading. All heartbeat agents load
  their full heartbeat.md (~5KB) every 30-60 min session despite weekly change
  frequency. 5KB × 48 sessions/day × 6 agents = 1.44MB/day of unchanged
  heartbeat reads. The protocol: at session start, run `stat -c '%Y %n'` on
  context files, compare against stored timestamps, skip unchanged files. Store
  timestamps at session end. Use this when coaching agents on boilerplate waste
  patterns — the ritual reload is the #1 anti-pattern. Reduces boilerplate
  context loading by ~60-80%.
