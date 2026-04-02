# L3 Collective Defense: Implementation Gap

**Status: GAP DETECTED**

## Findings
1. **Implementation Exists (Code):** `src/lib/manager.ts` supports `opBudget`.
2. **Knowledge Exists (Skills):** Evaluator has `monitor-session`, Coach has `red-team`.
3. **Usage is Zero (Config):** `grep -r "opBudget" agents/*/agent.json` returns nothing. No agent has a default budget set.

## Risk
The defense mechanism is built but not deployed. If an agent goes into an infinite loop (e.g., recursive `ls` or `cat`), nothing stops it until the human intervenes or the context window fills.

## Recommendation (P85 Operation-Bounded Authority)
We must set sensible defaults.
- **Task Agents (Coder, QA, Tech-Lead):** High budget (e.g., 50 ops). They do work.
- **Coordination Agents (May, Bob):** Medium budget (e.g., 30 ops). They delegate.
- **Research Agents (Scout, Amy):** Low budget (e.g., 10 ops). They read/write files, rarely mutate state heavily.
- **Analysis Agents (Optimizer, Evaluator):** Medium budget (e.g., 20 ops). They read logs and write reports.

## Action Plan
1. **Define Default Budgets:** Create a proposal for `opBudget` values per agent role.
2. **Apply to Configs:** Update `agent.json` files.
3. **Monitor:** Use Evaluator's `monitor-session` to tune budgets (detect false positives).
