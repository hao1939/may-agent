# Agent Improvement Workflow — Practical Details

Addendum to agent-improvement-workflow.md. Addresses real-world concerns.

## 1. Coverage: do we test existing good behaviors?

**We mostly don't.** 75/81 scenarios test coder. Other agents have 0-1 scenarios. Even for coder, the 13 smoke scenarios cover ~16% of total scenarios. We can't know if a change breaks behavior that no scenario tests.

**What to do about it:**

Before removing a rule or behavior from an agent, check: is there a gym scenario that tests this specific behavior? If not, you have two options:

a) **Write a scenario first.** Design a scenario that tests the behavior you're about to remove. Run it before and after the change. This is the safest path.

b) **Accept the risk.** If the behavior is clearly redundant (e.g., duplicated in common-sense.md), the risk of regression is low. Document what you removed and watch for failures in production evaluations.

Rule of thumb: **if you're removing a unique behavior (not duplicated elsewhere), write a scenario first. If you're removing a duplicate, smoke baseline is sufficient.**

## 2. Scenarios for the change you're making

The baseline tells you "nothing regressed." But it doesn't tell you "the change actually worked." For that, you need a scenario that specifically tests the improvement.

**Example:** You add the `search-strategy-escalation` skill to optimizer. The baseline confirms existing behaviors still pass. But does optimizer actually stop grep-spiraling now? You need the `search-strategy-escalation` gym scenario to verify the positive effect.

**Process:**
1. **Regression scenarios**: Run existing baseline (smoke or targeted)
2. **Improvement scenario**: Run (or create) a scenario that tests the specific behavior you're improving
3. Both must pass before shipping

## 3. Which benchmark level to run?

**Not every change needs a full benchmark.** Tiered approach:

| Change type | Benchmark level | Cost | When |
|---|---|---|---|
| Typo fix, wording tweak | None | $0 | Obviously safe |
| Remove a duplicated rule | Smoke (13 scenarios) | ~$1.50 | Quick confidence check |
| Add/modify a skill | Smoke + targeted scenario | ~$2 | Verify improvement + no regression |
| Major prompt restructure | Standard (66 scenarios) | ~$7 | Significant change needs broad coverage |
| Remove a unique behavior | Targeted scenario + smoke | ~$2 | Must verify the specific behavior |
| Change common-sense.md | Smoke per affected agent | ~$10+ | Affects everyone — need per-agent checks |
| Full system audit | Full (81 scenarios) | ~$35 | Periodic (weekly/monthly), not per-change |

**Coach and optimizer should default to smoke + targeted.** Full runs are for periodic audits or major changes.

## 4. Who designs scenarios?

**Three sources:**

a) **Coach** — designs scenarios for behaviors it wants to improve (training sprints). These test the positive case: "can the agent do X?"

b) **Optimizer/Human** — designs regression scenarios when removing or changing behaviors. These test the negative case: "does the agent still do X after we changed Y?"

c) **Agents finding gaps** — when a gym run reveals an untested behavior, anyone can design a scenario. The scenario becomes part of the permanent test suite.

**The missing piece: regression scenarios.** Nobody systematically writes "this works today, make sure it keeps working" scenarios. Coach writes improvement scenarios. We need someone (optimizer or a dedicated process) writing protection scenarios for critical behaviors before they're changed.

**Practical rule:** Before removing a rule from any agent's SOUL.md, ask: "Is there a scenario that tests this?" If no, write one. If yes, run it.

## 5. Scenario quality

A bad scenario gives false confidence. Types of scenario bugs:

- **success_criteria.js bug**: Checks the wrong field, silently passes everything
- **Too-easy task**: Agent passes without exhibiting the target behavior
- **Too-hard task**: Agent fails for unrelated reasons (infra, timeout, ambiguity)
- **Brittle checks**: Passes only with exact output format, fails on valid alternatives

**Quality measures:**

a) **Run with a deliberately bad agent.** If the scenario passes with an agent that shouldn't pass (e.g., one that never verifies), the scenario is too easy.

b) **Check that failing agents actually fail.** When a scenario reports FAIL, read the transcript. Is it failing for the right reason?

c) **Review success_criteria.js for bugs.** The `tc.arguments` vs `tc.args` bug was a real example. Criteria code needs review like any other code.

d) **Multiple runs.** If a scenario passes 2/3 times, it's flaky. Flaky scenarios should be fixed or removed from the baseline.

**Coach is responsible for scenario quality.** Optimizer can audit scenarios for bugs (it already found the tc.arguments bug).

## 6. Human feedback priority

The gym is the automated gate. Human feedback is the ultimate authority.

```
Human says "this is wrong" + gym says "pass" → Human wins. Fix the scenario.
Human says "this is fine" + gym says "fail" → Human wins. Fix the scenario.
Gym says "regression" + no human input     → Block the change. Investigate.
Gym says "pass" + no human input           → Ship it. Monitor in production.
```

**How this works in practice:**

- Human reviews the daily digest. Sees "coder SOUL.md slimmed, 0 regressions."
- Human can challenge: "But did you test the Post-Fix Audit behavior?" → Agent must show evidence (scenario exists and passes, or acknowledge the gap).
- Human can override: "I don't care about gym scores, this prompt is better because X." → Ship it.
- Human can escalate: "Run the full benchmark, I want to be sure." → Expensive but authoritative.

**The gym catches the obvious regressions.** Human judgment catches the subtle quality issues that no scenario tests. Both are needed. Neither alone is sufficient.
