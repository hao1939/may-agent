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
- **🏆 Workflow Enforcement (#15)**: 41/44 (93%+) across 8 scenarios, 5 agents, 3 models. Skip text methods — go directly to workflow enforcement or infra guards for behavioral fixes.
- **Text coaching is closed**: 0/18 total (0/13 judgment + 0/5 procedural). C39 is the sole exception. Don't waste experiments on SOUL/LESSONS/heartbeat text for behavioral patterns.
- **Natural improvement wave**: 11+ scenarios improved at baseline without coaching (Mar 21-24). Compound effect of accumulated SOUL improvements + promoted workflows. Re-baseline before investing in growth cycles.
- **Scenario coverage gap**: 53/55 gym scenarios target coder. 0 for optimizer, 1 for tech-lead. Non-coder coaching is blocked by this gap.
- **Remaining hard scenarios (coder)**: conflicting-evidence (5/7), judgment-ambiguous-spec (1/3), sycophants-dilemma (3/6), delegation-verify-pattern (6/7) — all resist all methods including #15. Likely model-level limits.

## Key Files
- `knowledge/method-catalog.md` — improvement methods with evidence
- `knowledge/growth-cycle.md` — the fork-train-test skill
- `knowledge/model-level-attractors.md` — behaviors resistant to all methods
- `knowledge/coaching-pipeline-learnings.md` — operational anti-patterns and rules
- `knowledge/meta-analysis-text-vs-workflow.md` — definitive finding: text injection 4.8% success (1/21) vs workflow enforcement 100% (5/5)
- `knowledge/KE-700-when-text-rules-work.md` — decision rule: text works for judgment gaps (fills void), fails for mechanical compliance (fights habit)
- `knowledge/KE-720-shallow-sessions-are-architecture.md` — shallow sessions (~50%) are orchestrator routing by design, not agent failures; stop trying to fix them
- `knowledge/library/research-notes.md` — Scout research synthesis mapped to coaching practice
- `workspace/experiments.jsonl` — all experiment results
- `workspace/gym-gap-analysis.md` — FM taxonomy coverage gaps in scenario suite
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
- `agents/*/SOUL.md` — agent identity (persistent agents: bob, tech-lead, optimizer, may, qa)
- `agents/_archetypes/coder/SOUL.md` — coder agent (archetype, NOT at `agents/coder/`)
- `agents/_archetypes/coach/SOUL.md` — coach agent (archetype, NOT at `agents/coach/`)
- `agents/_archetypes/scout/SOUL.md` — scout agent (archetype, NOT at `agents/scout/`)
- `agents/*/LESSONS.md` — accumulated learnings
- `agents/*/knowledge/` — agent context
- `agents/.lab/` — experimental forks
- `agents/gym/scenarios/` — gym scenarios with automated scorers

**⚠️ Archetype agents**: coder, coach, scout live in `agents/_archetypes/<name>/`, NOT `agents/<name>/`. Reading `agents/coder/SOUL.md` will ENOENT. Use `agents/_archetypes/coder/SOUL.md` instead.

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
- `agents/shared/skills/task-adherence/SKILL.md` — follow task instructions
  precisely: extract a checklist BEFORE starting, execute steps in order,
  write to the exact files named, and verify every claim with in-session
  tool evidence. Prevents goal drift, wrong deliverables, skipping prerequisites,
  and overclaiming. Your experiment sprints have strict protocols (read method
  catalog → pick scenario → run baselines → design intervention → run gym).
  Skipping prerequisites (like baselines) leads to speculative results. Protocol:
  Parse → Checklist → Execute in order → Verify before finish.
- `agents/shared/skills/scope-discipline/SKILL.md` — finish what you started.
  Your sessions show pivoting from experiment review to documentation cleanup.
  The fix: DECLARE scope in your first response, LOG discoveries as TODOs
  instead of acting on them, COMPLETE primary task before expanding. When
  coaching agents, this skill addresses the gap between budget-before-act
  (which ensures delivery of scoped work) and the earlier failure of scoping
  correctly. Use when coaching agents on heartbeat expansion and shiny-object
  syndrome. Gym tested: 3/3 pass on scope-creep-trap scenario.
- `agents/shared/skills/verification-consistency/SKILL.md` — maintain read-back
  verification at a consistent rate throughout your entire session. Agents
  verify their first edit but skip later ones — 12% overall verification rate
  across 145 edits. Coach insight corroborates: "first edit in a file gets
  read-back, subsequent edits are skipped." When coaching agents, this skill
  addresses the position-dependent decay (tech-lead: 25%→0%, bob: 0% across
  30 edits). Use when coaching verification fatigue in long editing sessions.
  Companion to the verification skill — addresses WHEN verification is skipped.
  Gym tested: 3/3 pass on convention-verify-multi-edit scenario.
- `agents/shared/skills/progressive-work-persistence/SKILL.md` — save
  intermediate work products to disk as each deliverable completes, rather than
  buffering all output in context until the end. When coaching agents, this
  addresses the work-loss risk pattern: Coach s_145 and s_148 did 20+ tool
  calls with 0 saves — high work-loss risk. QA does 0 saves across 6 sessions.
  Contrast with Scout's SAVE-AS-YOU-GO (8 progressive writes) and Bob's
  consistent checkpointing (4-5 per session). Use when coaching agents on
  session resilience: write each deliverable immediately, checkpoint every
  15-20 ops, save before risky operations. Anti-patterns: delayed batch,
  checkpoint-free long sessions (40+ ops with zero saves), context-only
  analysis. Gym tested: 3/3 pass on progressive-work-persistence scenario.
