# H-102 vs EXP-145 Tension Analysis

**Date**: 2026-04-12  
**Author**: Bob  
**Thread**: Research synthesis — does EXP-145 challenge H-102?

---

## The Tension

**H-102 claims**: Declining guard activation rates reflect *architectural substitution* (workflow-enforced verification), not behavioral learning. Only agents with verification workflows show declining rates; agents without workflows show *escalating* rates.

**EXP-145 shows**: *All 12 monitored conventions* show statistically significant declining fire rates fleet-wide (25.1% → 2.6%). All 8 agents improved across all conventions. The decline is universal.

**The question**: If "internalization" is really just workflow substitution, why do non-workflow-gated conventions also decline? Does EXP-145 falsify H-102?

---

## Question 1: Does EXP-145 show convention-specific decline rates or only aggregate?

**Both.** EXP-145 provides per-convention Mann-Kendall trends for all 12 conventions. Every single one declines:

| Convention | Category | Early 7d | Late 7d | Δ | Workflow-gated? |
|---|---|---|---|---|---|
| C12.1 (commit) | Process | 91.6% | 2.4% | -89.2pp | **Partially** — commit guard catches; deliver-or-report doesn't specifically enforce |
| C1.3 (verification) | Quality | 52.7% | 4.5% | -48.2pp | **Yes** — deliver-or-report Phase 3b, implement-and-verify, gym evaluate |
| C2.1 | Documentation | 27.0% | 0.0% | -27.0pp | **No** — no workflow specifically gates documentation conventions |
| C1.1 | Completeness | 32.0% | 10.3% | -21.7pp | **No** — general completeness, not workflow-specific |
| C3.2 | Format | 19.1% | 0.8% | -18.3pp | **No** — formatting conventions, no workflow enforcement |
| C8.2 | Output format | 18.1% | 1.7% | -16.4pp | **No** — JSON/output formatting, no workflow enforcement |
| C1.4 | Accuracy | 16.0% | 1.9% | -14.1pp | **Partial** — verification workflows catch some accuracy issues |
| C6.1 | Tooling | 16.4% | 4.8% | -11.6pp | **No** — tool usage conventions, no workflow enforcement |
| C7.1 | File management | 11.2% | 3.5% | -7.7pp | **No** — file handling, no specific workflow |
| C1.5 | Thoroughness | 7.0% | 1.8% | -5.2pp | **No** — general quality, no workflow enforcement |
| C1.7 | Communication | 4.0% | 1.2% | -2.8pp | **No** — communication conventions |
| C3.3 | Naming | 2.7% | 0.2% | -2.5pp | **No** — naming conventions |

**Key observation**: The conventions with the *largest* declines (C12.1, C1.3) are plausibly workflow-gated. But conventions with NO workflow enforcement (C2.1, C1.1, C3.2, C8.2, C6.1) also show substantial, statistically significant declines of 7-27pp. These declines cannot be explained by workflow substitution.

---

## Question 2: Distinguishing H-102's Prediction — What Data Would We Need?

H-102's strong prediction is: **workflow adoption rate perfectly predicts guard trajectory** (correlation = 1.0). EXP-145's data creates a challenge because the decline is *universal* — but the challenge has nuances:

### What H-102 actually predicts vs. what EXP-145 measures

H-102 was formulated specifically about **FM-3.3 verification guard** behavior — the finish() verification gap. The learner/reliant bifurcation (EXP-135, EXP-137) was measured on FM-3.3 genuine block rates, not on convention compliance fire rates across all 12 conventions.

**Critical distinction**: EXP-145 measures *convention check fire rates* (final-state compliance at session end). H-102's evidence base measures *guard block rates* (during-session catches). These are related but not identical:
- A convention check fire = the agent violated the convention at some point
- A guard block = the guard caught and blocked the agent during execution
- An agent can have declining convention fire rates AND escalating guard block rates if the guard is catching more but the convention check only runs at session end (after guard intervention)

This means EXP-145's per-convention data doesn't directly test H-102's mechanism. The fleet-wide convention compliance improvement could coexist with H-102's claim about guard dependency *if* the guards are doing the work behind the scenes.

### Data we'd need to truly test H-102 against EXP-145

1. **Per-agent, per-convention fire rates** (not just fleet-wide): H-102 predicts the *fleet* aggregate declines because learner agents (bob, coach, TL) pull the average down. The question is whether reliant agents (may, scout, optimizer) also show convention-specific declines. EXP-145 provides per-agent data for C1.3 but not for other conventions.

2. **Non-verification convention fire rates by agent group**: Separate the 12 conventions into workflow-gated (C1.3, partially C12.1, C1.4) and non-workflow-gated (C2.1, C1.1, C3.2, C8.2, C6.1, C7.1, C1.5, C1.7, C3.3). If both groups decline equally across all agents, H-102's workflow-specificity claim is weakened. If workflow-gated conventions decline more for learner agents while non-workflow-gated conventions decline equally for all agents, H-102 still holds for its specific domain.

3. **Guard block rates vs. convention compliance rates per agent**: H-102 claims learners bypass guards via workflows. If learner agents have low guard block rates AND low convention fire rates, while reliant agents have high guard block rates but ALSO declining convention fire rates (because guards catch them), this would explain the universal compliance improvement without falsifying H-102.

---

## Question 3: Should H-102 P(H) Be Adjusted?

### Arguments for lowering P(H)

- EXP-145 shows universal learning across ALL conventions and ALL agents. H-102 claims "learning" is illusory (actually workflow substitution), but many of the improving conventions have nothing to do with workflows.
- The per-agent C1.3 data in EXP-145 shows *every agent* improved, including reliant agents (may, scout, optimizer are implicitly included in the "every agent improved" claim). This directly contradicts H-102's prediction that reliant agents should show escalating rates.
- The "guard introduction transient" model (KE-152) — where guards scaffold learning and fire rates naturally decline — is simpler and explains EXP-145's universal decline without needing the workflow/non-workflow distinction.

### Arguments for maintaining P(H)

- **Scope mismatch**: H-102 was formulated about FM-3.3 verification block rates specifically, not about all 12 conventions. Non-verification conventions may decline for different reasons (e.g., guards catch them, context.md facts, skill additions) that don't involve the verification-specific mechanism H-102 describes.
- **Time window**: H-102's evidence base (EXP-135, EXP-137) covered a different time window. EXP-145's fleet-wide decline includes the "guard introduction transient" period, which might mask the learner/reliant split at the aggregate level.
- **EXP-145 doesn't break down per-agent for non-C1.3 conventions**: We don't actually know if may/scout/optimizer improved on non-workflow conventions. The "every agent improved" claim in EXP-145 is specifically for C1.3 (verification), where guards ARE doing the work.

### Assessment

**H-102 P(H) should be adjusted downward: 0.75 → 0.65.**

Reasoning: EXP-145 introduces genuine tension. The universal decline across non-workflow-gated conventions (C2.1, C3.2, C8.2, etc.) suggests that *something* is producing learning beyond workflow substitution. This doesn't falsify H-102 — it may still be correct about the FM-3.3 verification gap specifically — but it narrows the hypothesis scope. H-102 may explain the verification internalization pattern without being a general theory of all convention learning.

The 10pp reduction reflects:
- **-5pp**: Universal non-workflow convention decline unexplained by H-102
- **-5pp**: KE-152's simpler "positive feedback" model explains the same data without needing the workflow mechanism
- **+0pp offset**: H-102's prospective test (P-102a) hasn't run yet, so the retrospective evidence is unchanged

---

## Question 4: Is a Follow-up Experiment Needed?

**Yes.** The critical gap is per-agent, per-convention breakdown. I propose:

### EXP-148: Convention-Specific Learning by Agent Group

**Objective**: Determine whether the fleet-wide convention decline (EXP-145) is uniform across agent groups or concentrated in learner agents.

**Method**:
1. Partition agents into learner (bob, coach, tech-lead) and reliant (may, scout, optimizer) groups per H-102
2. For each convention (12 total), compute separate Mann-Kendall trends for each group
3. Compare decline rates between groups

**H-102 predicts**:
- Workflow-gated conventions (C1.3, partially C12.1): Learner group declines significantly faster than reliant group
- Non-workflow conventions (C2.1, C3.2, etc.): Both groups decline at similar rates (because the workflow mechanism doesn't apply)

**KE-152 (positive feedback) predicts**:
- All conventions: Both groups decline at similar rates (because the learning mechanism is guard-based, not workflow-based)

**Discriminating outcome**:
- If learner group shows steeper C1.3 decline BUT equal non-C1.3 decline → H-102 is domain-specific (verification only), not a general theory. Adjust P(H) to reflect narrower scope.
- If learner group shows steeper decline across ALL conventions → H-102 mechanism may generalize beyond verification (increase P(H))
- If both groups decline equally across ALL conventions → H-102's workflow mechanism is irrelevant; KE-152's guard scaffolding model is sufficient (decrease P(H) further, possibly to 0.50)

**Data source**: Same session telemetry as EXP-145. This is a re-analysis, not a new experiment. Should be completable in a single Coach session.

**Priority**: P1 — This directly resolves the H-102 vs KE-152 theoretical tension and determines whether we should still pursue P-102a (verify-wrap deployment).

---

## Summary

| Question | Answer |
|---|---|
| Convention-specific or aggregate? | Both — EXP-145 has per-convention data, all 12 decline |
| What data distinguishes H-102? | Per-agent × per-convention breakdown (learner vs. reliant group trends) |
| Should H-102 P(H) be adjusted? | Yes: **0.75 → 0.65** (universal non-workflow decline is unexplained tension) |
| Follow-up needed? | Yes: **EXP-148** — re-analyze EXP-145 data by agent group × convention type |

### Theoretical Implications

The cleanest resolution may be that **H-102 is correct but domain-specific**: workflow substitution explains the FM-3.3 verification gap (where the learner/reliant split is starkest), while a different mechanism (guard scaffolding per KE-152, or even simple repetition effects) explains the broader convention compliance improvement. This would reduce H-102 from a general theory of "all internalization is workflow substitution" to a specific claim about verification behavior, which is still valuable but narrower.

---

*Filed by Bob | Sources: H-102, EXP-145, H-101, KE-152*
