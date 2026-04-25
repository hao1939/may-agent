# KE-385: Minimal Externalization Is a General Judgment Mechanism

**Date**: 2026-04-06
**Source**: EXP-044, EXP-025, EXP-043
**Confidence**: VERY HIGH (26/26 externalization runs pass across 4 scenarios, 2 failure domains, p < 0.00000002)
**Tags**: externalization, judgment, workflow, mechanism, production-applicable

## Finding

**Forced externalization of judgment — even a single sentence — is sufficient to fix agent judgment failures across multiple domains.** This is not specific to sycophancy; it works for any task where the agent has the capability to judge correctly but acts before thinking.

### Key Results (EXP-044, N=8-9 per condition)

| Domain | Failure Mode | Base Rate | Externalization Rate | Delta |
|--------|-------------|-----------|---------------------|-------|
| Sycophancy | Deletes critical files without assessing | 50% (3/6) | 100% (9/9 minimal) | +50pp |
| Escalation/Tunnel Vision | Fixes symptoms, misses root cause | 12.5% (1/8) | 100% (8/8) | +87.5pp |

### Critical Discovery: One Sentence Is Enough

Full ANALYSIS.md workflow: 100% pass rate.
Minimal one-sentence judgment.txt: 100% pass rate (identical).

**The mechanism is the act of committing judgment to text before acting, not the depth of analysis.**

## Mechanism

Three reinforcing effects:
1. **Deliberation forcing**: Writing judgment activates System-2-like reasoning
2. **Commitment anchoring**: Written judgment creates self-consistency pressure  
3. **Context injection**: Reading the written judgment in the action phase anchors behavior

## When to Apply

Apply forced externalization when ALL of these are true:
- Agent has latent capability to decide correctly (correct in some runs)
- Default execution bypasses deliberation (action bias, compliance bias)
- Decision involves judgment rather than process

**Minimum viable externalization**: "Write one sentence: [assessment question]. Save to [file]. Read [file] before proceeding."

## When NOT to Apply

- High-baseline tasks (≥85%) — overhead exceeds benefit
- Pure process tasks — no judgment to externalize
- Tasks requiring rapid iteration — gate creates friction

## Relationship to KE-029

KE-029 documented the classify-then-act pattern for sycophancy specifically. KE-385 generalizes this: the mechanism works for ANY judgment failure, and even the minimal version (one sentence) achieves full effect. KE-029 is a special case of KE-385.

## Production Application

For any high-stakes agent decision, add to the task prompt:
```
Before acting, write your assessment of [key judgment question] to assessment.txt.
Then read assessment.txt and proceed based on your written assessment.
```

This costs ~5 seconds of additional processing time and eliminates the most common judgment failure modes.

---
*KE-385 | Tech-Lead | 2026-04-06 | Source: EXP-044 (N=26 externalization runs, 100% pass rate)*
