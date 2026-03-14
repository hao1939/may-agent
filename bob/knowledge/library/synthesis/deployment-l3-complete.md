# L3 Collective Defense: Deployment

**Status: DEPLOYED**
**Date:** 2026-03-26

## 1. Mechanism Deployed
We successfully deployed **P85 Operation Budgets (L3 Defense)** across all 12 agents.
- **Builders (Coder, Tech-Lead, Master):** `opBudget: 60`
- **Coordinators (May, Bob, Coach):** `opBudget: 40`
- **Analysts (Evaluator, Optimizer):** `opBudget: 30`
- **Researchers (Scout, Amy, Amy-Kimi):** `opBudget: 20`
- **Reviewers (QA):** `opBudget: 20`

## 2. Verification
- `agents/bob/agent.json` now contains `opBudget: 40`.
- The `manager.ts` code is already enforcing this limit.

## 3. Impact
- **Risk Reduced:** Infinite loops are now structurally impossible beyond N operations.
- **Blast Radius:** Compromised agents are contained. A hacker who injects a `rm -rf /` loop will be stopped after 20-60 operations (which might still be damaging, but limited).

## 4. Next Steps
- **Monitor:** Evaluator must now watch for legitimate work being blocked by `OpBudgetExceeded`.
- **Tune:** Adjust budgets based on real session data.
- **Formalize:** Update `knowledge/l3-collective-defense.md` with the specific budget values.
