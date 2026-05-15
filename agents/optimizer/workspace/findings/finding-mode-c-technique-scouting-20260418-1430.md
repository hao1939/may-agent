# Mode C: Skill & Technique Scouting — 6h scan (Apr 18 ~14:30 UTC)

## Summary

Investigated the coach 57-op session (metric-reaction scenario) and the 49-op coach session, plus compared lean vs bloated patterns across the 6h window. **The 57-op session is legitimate work (gym scenario creation + baseline runs), rated good (q=1.0). The real problem is the 49-op session (q=0.34, needs_improvement) — a classic FM-2.6 reasoning-action mismatch.** No new skill candidates found; existing patterns hold.

## Key Sessions Analyzed

### Coach 57-op (s_1776515111675_166) — metric-reaction scenario creation
- **Task**: Complete partially-built metric-reaction gym scenario + run baseline
- **Quality**: 1.0, Efficiency: 0.8, Verdict: good
- **Analysis**: This is NOT bloated. Creating a gym scenario from scratch (scenario.json, task.md, package.json, success_criteria.js, environment setup) plus running baseline trials legitimately requires ~50-60 ops. No waste identified.
- **Pattern**: Gym scenario creation is inherently op-heavy. This is the expected cost.

### Coach 49-op (s_1776518709125_231) — FM-2.6 mismatch, needs_improvement
- **Task**: Design and build persistent-task-adoption scenario + 10-trial baseline
- **Quality**: 0.34, Efficiency: 0.58, Verdict: needs_improvement
- **Issue**: FM-2.6 — tasked to create new scenario but instead modified existing `use-persistent-task*` scenarios. Never produced the requested deliverables.
- **Pattern**: This is the recurring FM-2.6 "delegation instead of execution" pattern already tracked in EXP-117.

### Bob 38-op (s_1776507762393_100) — batch-resolve hypotheses
- **Quality**: 0.9, Efficiency: 0.62
- **Previously flagged**: Mode B found repeated hypothesis-checking pattern in this session.

## Lean vs Bloated Comparison (6h window)

| Metric | Lean (≤15 ops, q≥0.8) | Bloated (>30 ops) |
|--------|----------------------|-------------------|
| Count | 18 sessions | 5 sessions |
| Avg ops | 7.2 | 41.0 |
| Avg quality | 0.95 | 0.76 |
| Agents | scout, may, optimizer, bob, tech-lead, coach | coach (3), bob (1), scout (1) |

**Key observation**: Coach dominates the bloated category (3/5 sessions >30 ops). Two of three are work sessions doing gym/experiment work — inherently heavier. The third (49-op) is pure waste via FM-2.6.

## Technique Patterns

### What lean sessions do well:
1. **Fast dispatch**: Heartbeats that read context → fork work → finish in 3 ops
2. **Single-purpose**: One clear objective, executed directly without exploration
3. **Pre-existing context**: Sessions that already know what files to read (from context.md or dispatch task)

### What bloated sessions do differently:
1. **Gym scenario creation**: Inherently 40-60 ops (file creation + validation + test runs). Not reducible without infra changes.
2. **FM-2.6 drift**: Agent starts working on related-but-wrong target, consuming ops without progress toward actual deliverables.

## Recommendations

- **NO_DISPATCH** — No new skill/technique candidate identified. The 57-op session is legitimate. The 49-op failure is FM-2.6, already tracked.
- Coach gym scenario creation cost (~50 ops) is structural. Only reducible via scenario templates or scaffolding tools (already identified in prior Mode B findings).
- FM-2.6 intervention is coach's responsibility (EXP-117).

## Dispatch Decision: NO_DISPATCH
No actionable dispatch. Findings reinforce existing knowledge.
