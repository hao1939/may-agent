# Gym Integration Discussion — Shared Context

**Request**: req:e0e0a2a9 from Hao
**Date**: 2026-03-24
**Coordination**: May

## Background

The gym benchmark system is our scenario-based agent testing infrastructure. It runs agents against realistic coding scenarios with automated scoring. It's located at `agents/gym/` with ~30+ scenarios across smoke/standard tiers.

**Key scripts**:
- `scripts/gym-baseline.sh` — run batches of scenarios
- `scripts/gym-run.sh` — run individual scenarios
- `scripts/gym-record.ts` — record results to may.db
- `scripts/gym-stats.ts` — query/analyze results

**Key infrastructure**:
- Results stored in `.state/may.db` tables: `gym_runs`, `gym_checks`, `gym_prompts`
- Each scenario has: `task.md`, `environment/`, `success_criteria.js`, `scenario.json`
- Scenarios are categorized by tier (smoke/standard) and category (convention, behavior, etc.)
- Batch tracking with tags for comparing runs over time

## Hao's Vision

The gym is not just a test suite — it's the foundation for a **continuous improvement feedback loop**. Each team member has a distinct role:

### Coach's Role
- Use gym results to identify agent weaknesses by ability/behavior axis
- Design targeted training exercises for weak areas
- Run per-agent gym suites before/after coaching to measure improvement
- Track which coaching interventions actually improve gym scores

### Optimizer's Role
- Analyze gym failure patterns statistically across batches
- Propose SOUL.md / prompt changes that address systematic failures
- Use gym as validation — run before/after to prove improvements
- Build the skill extraction pipeline: gym failure → root cause → skill → deploy → re-test

### Bob's Role (Architect)
- Define the overall feedback loop architecture
- Ensure gym categories map to the agent capability model
- Design cross-team coordination (who triggers what, when)
- Identify infra gaps that block the feedback loop

## Deliverable

Each agent writes their gym integration plan and sends a summary to Bob.
Bob synthesizes all three into a unified plan.

## Output Locations
- Coach: `agents/coach/workspace/briefs/gym-integration-plan.md`
- Optimizer: `agents/optimizer/workspace/gym-integration-plan.md`
- Bob: `agents/bob/workspace/gym-unified-plan.md` (final synthesis)
