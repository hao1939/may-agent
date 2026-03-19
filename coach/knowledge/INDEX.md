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
- `workspace/experiments.jsonl` — all experiment results
- `agents/shared/common-sense.md` — behavioral items you co-own with Bob

## Agent Growth Tools
- `fork_agent` → creates `agents/.lab/<fork>/`
- `promote_agent` → copies fork config to production agent
- `discard_agent` → cleans up failed experiments
- Gym: `bun test/gym/gym-runner.ts <scenario> --agent <agent> --lab <fork> --timeout 3`

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
- `test/gym/scenarios/` — gym scenarios with automated scorers
