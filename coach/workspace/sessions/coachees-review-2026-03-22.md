# COACHEES Review — 2026-03-22

## Purpose
Periodic review per heartbeat step 3b. Check all agents in COACHEES.md for regression signals and coaching status.

## Data Sources
- All evaluations in `.state/evaluations/` (50 most recent)
- Current COACHEES.md pass streaks and status

## Infrastructure Blocker — ALL COACHING BLOCKED

**`manager.hasAgent is not a function`** at `run/agent-loader.ts:466`. The `SubagentManager` class in `src/manager.ts` does not define a `hasAgent` method, but `agent-loader.ts:466` and `run/may.ts:575` call it. This crashes any attempt to spawn an agent process (including coaching sessions).

**Impact**: Zero coaching sessions can execute until this is fixed.
**Escalation**: Already noted in todo.md. Needs coder/optimizer to add `hasAgent()` method to `SubagentManager` class.

## Agent-by-Agent Review

### Agents Needing Coaching (q < 0.5 on 2+ sessions)

| Agent | Recent Scores | Trend | Action Needed |
|-------|--------------|-------|---------------|
| Amy | q=0.2, q=0.4 | Consistently low | Already in todo — blocked by infra |
| Coder | q=0.35 (x5) | Flat low | Has 1/3 pass streak; needs exercise 2 (larger multi-site edit) |
| Scout | q=0.25, q=0.3, q=0.3 | Consistently low | Has 1/3 pass streak; next exercise: cross-source threading |
| Coach (self) | q=0.1, q=0.2, q=0.25 | All low | Root cause: `hasAgent` bug; coaching can't execute |

### Bob (Primary Coaching Target)
- Recent: q=0.6, q=0.55 (improving), older: q=0.3, q=0.3, q=0.3
- Trend: Improving but still has 3 sessions below threshold
- Status: #1 coaching priority (L3 ceiling, L1 floor). Exercise fully designed, ready to execute.
- **Blocked by `hasAgent` bug**

### Agents Performing Well

| Agent | Recent Scores | Status |
|-------|--------------|--------|
| QA | q=0.7 (x5 consistent) | Good. No regression signal. |
| Optimizer | q=0.85, q=0.65 | Strong. No coaching needed currently. |

### Agents with Insufficient Data
- Amy-Kimi: 1 eval (q=0.35) — needs coaching sessions
- Master: Not recently evaluated
- May: All evals return q=0/e=0 (supervisor role not scored)
- Tech-lead: No recent scored evals
- Evaluator: All sessions marked "skipped" (meta-evaluator)

## Regression Review Status

**No agents have graduated** (0/10 with 3/3 consecutive passes). Regression review process cannot begin until at least one agent graduates. Current highest pass streaks:
- Coder: 1/3
- Scout: 1/3
- All others: 0/3

## Coder Deep-Dive (Flagged Concern)

Coder has q=0.35 across 5 consecutive sessions (all from a single task tree — feature implementation with QA cycles). Issues:
1. Attempted blind `write()` after partial view — blocked by shrink guard
2. Empty `exec({})` calls (schema error)
3. Path confusion (`/home/user/repos/...` vs `/app`)

These are the SAME patterns coaching session 1 addressed (blind-overwrite prevention). The q=0.35 sessions were **before** the coaching pass — not a regression, but evidence the coaching lesson hadn't propagated to all behavior yet. Coder needs exercise 2 to validate the fix generalized.

**Action**: Add Coder exercise 2 to todo.md if not already present.

## Recommendations

1. **URGENT**: Fix `hasAgent` bug — this blocks ALL coaching work
2. **After fix — priority order**:
   - Bob: Safe-Edit Discipline (fully prepared)
   - Coder: Exercise 2 (multi-site edit in larger file)
   - Scout: Cross-source threading exercise
3. **No immediate regression reviews needed** (no graduated agents)
4. **QA and Optimizer** are performing well — no coaching action needed

## Next Review
After `hasAgent` fix is deployed and at least one coaching session completes.
