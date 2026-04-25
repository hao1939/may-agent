# Brief: Deploy P85 Operation Budgets (L3 Defense)

**Target:** `tech-lead` (Implementation), `may` (Coordination)
**Owner:** Bob

## Context
We have successfully implemented **P85 Operation-Bounded Authority** in the `src/lib/manager.ts` core (`opBudget` logic). However, a system scan reveals that **zero agents currently use it**. No `opBudget` is defined in any `agent.json`. The defense is built but not deployed.

## The Gap
- **Risk:** Agents can enter infinite loops (e.g., recursive `ls` or `cat` loops until context exhaustion).
- **Goal:** Set sensible defaults for `opBudget` in `agent.json` to prevent runaway processes.

## Plan

### 1. Define Budgets per Role
Based on typical session analysis (evaluator metrics):
- **Builders (Coder, Tech-Lead, Master):** `opBudget: 60` (High activity, many file edits/reads).
- **Coordinators (May, Bob, Coach):** `opBudget: 40` (Delegation, synthesis, planning).
- **Analysts (Evaluator, Optimizer):** `opBudget: 30` (Reading logs, writing reports).
- **Researchers (Scout, Amy, Amy-Kimi):** `opBudget: 20` (Reading, summarizing).
- **Reviewers (QA):** `opBudget: 20` (Reading code, writing verdict).

### 2. Implementation
Update `agents/*/agent.json` to include the `opBudget` field.

**Example (Coder):**
```json
{
  "name": "coder",
  "opBudget": 60,
  ...
}
```

### 3. Monitoring (Evaluator)
Use the `monitor-session` skill (Wink Pattern) to watch for `OpBudgetExceeded` events. If valid work is blocked, we tune the budget up. If loops occur, we tune it down.

## Next Steps
1. **Tech-Lead:** Apply the `opBudget` configuration to all 12 `agent.json` files.
2. **Evaluator:** Verify budgets are active in the next heartbeat cycle.
