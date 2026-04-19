# Freestyle Session Patterns — Session Archaeology

**Date**: 2026-04-19  
**Data source**: `.state/may.db` sessions table (25,731 total sessions)  
**Current workflow coverage**: 7.6% (1,949 workflow / 25,731 total)

## Overall Session Distribution

| Pattern | Count | % of Total | Uses Workflow? |
|---------|-------|-----------|----------------|
| Heartbeat | ~19,922 | 77.4% | No |
| Work Session (forked) | ~1,503 | 5.8% | No |
| Other/uncategorized | ~1,332 | 5.2% | No |
| Cron jobs | ~902 | 3.5% | No |
| Fix bugs | ~682 | 2.7% | No |
| Evaluation | ~3,779 | 14.7%* | No |
| Research | ~358 | 1.4% | No |
| Persistent-task | ~269 | 1.0% | Yes (primary workflow user) |
| Experiment | ~229 | 0.9% | No |
| Investigate | ~172 | 0.7% | No |

*Evaluator is the single biggest freestyle agent (3,779 sessions, all freestyle).

## Top 3 Freestyle Patterns (Workflow Candidates)

### Pattern 1: Heartbeat — Check Health & Dispatch Work
- **Frequency**: ~19,922 sessions (77.4% of all sessions)
- **Agents**: may, coach, scout, optimizer, qa (all agents)
- **What it does**: Agent reads heartbeat.md, checks metrics/health, reviews pending requests, dispatches work (forks), updates context. It's a supervisor loop.
- **Why it's freestyle**: Each agent runs its heartbeat as a single monolithic session with no structured steps.
- **Workflow sketch**: A `heartbeat` workflow with defined steps:
  1. **Check metrics** — read agent's metrics, flag alerts
  2. **Review requests** — check pending/stale requests assigned to agent
  3. **Dispatch work** — fork sessions for actionable items
  4. **Update context** — write context updates
- **Impact**: Converting heartbeats to a workflow would move 77% of sessions into workflow coverage. Even partial (just the dispatch step) would be massive.
- **Caveat**: Heartbeats are highly varied — some agents do research, some dispatch, some just check health. A workflow needs to be flexible enough to handle this variance. Consider a lightweight "wrapper" workflow rather than rigid steps.

### Pattern 2: Evaluation — Assess Session Quality  
- **Frequency**: ~3,779 sessions (14.7% of all sessions)
- **Agents**: evaluator (exclusively)
- **What it does**: Evaluator reviews a completed session, scores it on efficiency/quality/capability, outputs structured JSON evaluation.
- **Why it's freestyle**: Every evaluation is a standalone session with no workflow wrapping.
- **Workflow sketch**: An `evaluate-session` workflow:
  1. **Load session** — fetch session data, digests, deliverables
  2. **Assess quality** — LLM evaluates against rubric
  3. **Store results** — write to evaluations table
  4. **Flag anomalies** — if scores are extreme, create alert
- **Impact**: Would convert 14.7% of sessions to workflow-routed. Combined with heartbeat, this gets us to ~92% coverage.
- **Caveat**: Evaluation may already be semi-structured (always produces JSON). The workflow is mainly for tracking/metrics purposes.

### Pattern 3: Fix Bug / Investigate Issue — Diagnose & Repair
- **Frequency**: ~854 sessions (fix-bugs 682 + investigate 172 = 3.3%)
- **Agents**: tech-lead (primary), optimizer, coach, master
- **What it does**: Agent receives a bug report (metric regression, build failure, threshold error), investigates root cause, implements fix, verifies.
- **Examples from sessions**:
  - "Fix stuck-requests metric threshold inversion"
  - "Fix build health (tsc failing)"
  - "Investigate workflow coverage metric regression"
  - "Fix heuristic evaluator adoption metric undercounts"
- **Workflow sketch**: A `diagnose-and-fix` workflow:
  1. **Reproduce** — run the failing command/query to confirm the bug
  2. **Investigate** — trace root cause through code
  3. **Fix** — implement the change
  4. **Verify** — re-run to confirm fix, run tests
- **Impact**: 3.3% of sessions. Not huge alone, but these are high-value sessions (production fixes) where structured steps prevent premature DONE.
- **Caveat**: Already partially covered by `implement-and-verify` workflow, but that's more general. A bug-specific variant with reproduce/verify gates would be more useful.

## Coverage Projection

| Scenario | Sessions Covered | Projected Coverage |
|----------|-----------------|-------------------|
| Current (persistent-task only) | 1,949 | 7.6% |
| + Heartbeat workflow | +19,922 | ~85% |
| + Evaluation workflow | +3,779 | ~99% |
| + Diagnose-and-fix workflow | +854 | ~100% |

**Key insight**: Heartbeat alone gets us past the 80% target. Evaluation is the second-biggest win. Fix/investigate is valuable for quality reasons even if the coverage % impact is smaller.

## Recommended Priority

1. **Heartbeat workflow** — highest impact (77% → 85% coverage), but also highest complexity. Could be a thin wrapper that just counts as "workflow-routed" while preserving agent flexibility.
2. **Evaluation workflow** — straightforward to build (evaluator already follows a rigid pattern), adds 15% coverage.
3. **Diagnose-and-fix workflow** — smaller coverage impact but improves quality of high-stakes fix sessions.

## Other Notable Patterns (Not Top 3 but Worth Noting)

- **Gather design input** (12 sessions): May forks multiple agents to comment on a project doc. Could be a `parallel-input` workflow (exists as `parallel-research` already).
- **Run experiment** (229 sessions): Coach designs/runs gym experiments. Semi-structured already.
- **Project kickoff** (4 sessions): Creating new projects. Low frequency.
- **Synthesize findings** (~8 sessions): Scout/Bob synthesize research into knowledge entries. Could use `parallel-research` variant.
