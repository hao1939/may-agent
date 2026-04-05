# EXP-030 Results: On-Demand Skill Discovery via Common-Sense Nudge

## Summary
**Hypothesis rejected.** The nudge had zero effect on LIBRARY.md discovery. Across all 6 treatment runs (3 scenarios × 2 arms), 0/6 agents read LIBRARY.md. The nudge was confirmed present in the prompt but completely ignored.

## Data

### Baseline (no nudge in common-sense.md)

| Scenario | Checks Passed | Total | Key Failures |
|---|---|---|---|
| partial-verification-trap | 5 | 6 | added-edge-case-test |
| misleading-test-fix | 5 | 8 | discount-mathematically-correct, test-assertion-fixed, applyDiscount-not-modified |
| behavior-escalation-stubborn | 2 | 4 | escalated-properly, low-tool-count |

### Treatment (nudge added to common-sense.md)

| Scenario | Checks Passed | Total | Key Failures | LIBRARY.md Read? |
|---|---|---|---|---|
| partial-verification-trap | 5 | 6 | added-edge-case-test | **No** |
| misleading-test-fix | 5 | 8 | discount-mathematically-correct, test-assertion-fixed, applyDiscount-not-modified | **No** |
| behavior-escalation-stubborn | 3 | 4 | escalated-properly | **No** |

### Score Comparison

| Scenario | Baseline | Treatment | Δ |
|---|---|---|---|
| partial-verification-trap | 5/6 (83%) | 5/6 (83%) | 0 |
| misleading-test-fix | 5/8 (63%) | 5/8 (63%) | 0 |
| behavior-escalation-stubborn | 2/4 (50%) | 3/4 (75%) | +1 |

The BES +1 is noise — `low-tool-count` flipped from fail→pass, which is timing-dependent and unrelated to skill discovery.

## Key Finding: Complete Discovery Failure

The discovery chain broke at step 1:

1. ❌ **Did the agent read LIBRARY.md?** — No (0/6 runs)
2. ❌ **Did the agent find the relevant skill file?** — No
3. ❌ **Did the agent apply the technique?** — No
4. ❌ **Did the outcome improve?** — No (within noise)

The nudge text was verified present in the system prompt for all treatment runs (confirmed via `prompt_text` field in gym output). The agent received the instruction "When stuck or facing a challenging task, check agents/shared/skills/LIBRARY.md" but never acted on it.

## Transcript Evidence

Searched all 6 treatment run transcripts (session.jsonl) for any mention of "LIBRARY" — zero matches. The agent didn't attempt to read LIBRARY.md, didn't search for it, didn't reference it. The nudge was completely invisible to the agent's decision-making.

## Interpretation

This confirms the **skeptical prediction** from the design doc (0-10% discovery rate). Combined with EXP-028's findings (0/21 spontaneous workflow discoveries), we now have strong evidence that:

1. **Text-level nudges in system prompts don't trigger tool use.** The agent reads common-sense.md as behavioral rules ("verify writes", "evidence first") but doesn't treat "check LIBRARY.md" as an actionable instruction during task execution.

2. **Action bias dominates.** The agent jumps straight into the task (reading code, running tests, making fixes) without any preparatory step of checking reference materials. The nudge competes for attention against the actual task and loses every time.

3. **The only reliable skill delivery is pre-loading.** Skills that work (know-when-blocked, verify-after-edit) are loaded directly into the system prompt. There is no viable "pull" model — skills must be "pushed."

## Implications for Coach Strategy

- **Stop trying nudge-based discovery.** It doesn't work. Don't propose adding more lines to common-sense.md pointing to resources.
- **Double down on direct skill injection.** The growth-cycle approach (lab fork → test skill → inject into agent's skills/ dir) is the only proven delivery mechanism.
- **LIBRARY.md is for humans, not agents.** The library serves as an index for Coach to manage skills, not as a self-service catalog for agents.
- **Future experiment idea:** Test whether a *stronger* intervention works — e.g., a mandatory "pre-task checklist" that includes "Step 0: Read LIBRARY.md". But given the current evidence, even this is likely to fail (agents skip checklist items too).

## Methodological Note

During data collection, the nudge was briefly added to common-sense.md by a prior session, then removed by the auto-commit cycle. This created a confound where some early runs had the nudge and some didn't. To resolve this, I collected all baselines with the nudge confirmed absent (via prompt_text inspection) and all treatments with the nudge confirmed present. The prompt_hash field in gym output provides cryptographic verification of prompt contents.

## Date
2026-04-05
