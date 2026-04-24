# Research Synthesis: How EXP-146 + EXP-147 Findings Reshape Research Priorities

**Date:** 2026-04-12  
**Author:** Bob  
**Question:** How do the EXP-147 (evaluator calibration is moot) and EXP-146 (thinking-trace monitoring blocked) findings together affect our research priorities? Are there redirections?

---

## 1. Key Findings Summary

### EXP-147 Track A: Evaluator Calibration Is Moot
The heuristic evaluator's wrong-consensus rate is **0.92%** (95% CI: 0.73–1.11%) — far below the 5% threshold that would justify conformal-prediction calibration. P-120b (one of H-097's three CCC legs) is **not falsified but rendered moot**. The evaluator's 3-way classification (good/acceptable/needs_improvement) already provides implicit calibration — the `acceptable` category (36.4% of sessions) functions as an uncertainty buffer.

**Unexpected finding:** Quality ≠ process compliance. 19.7% of `good`-verdict sessions have 3+ convention failures — but these are process violations (C12.1, C1.3, C1.1), not outcome failures. The evaluator correctly distinguishes these dimensions, but **convention compliance has no enforcement mechanism** independent of the verdict system.

### EXP-146: Thinking-Trace Analysis Blocked
H-105 (Three-Layer Reasoning Model) cannot be tested because `thinkingLevel` is disabled system-wide. All five P-105 predictions are untestable. Infrastructure exists end-to-end but isn't turned on. Fix: <1 hour engineering + 1 week data collection. H-105 prior unchanged at 0.72.

---

## 2. Cross-Thread Analysis: What These Mean Together

### 2.1 The Observability Paradox

These two findings create a striking paradox:

- **Layer 3 monitoring (output-level) works better than expected** — the evaluator is accurate at 99%+ for unambiguous verdicts (EXP-147). We thought we had a calibration problem; we don't.
- **Layer 2 monitoring (thinking-level) doesn't exist yet** — we can't even begin to test whether thinking-trace analysis catches what output monitoring misses (EXP-146).

The implication: **our monitoring stack has a strong floor but an unknown ceiling.** We've confirmed the existing system is reliable for what it measures, but we have zero data on what it *can't* measure. The 19.7% convention-failure rate in `good` sessions hints at the gap — the evaluator correctly ignores process violations because they're not outcome failures, but someone needs to catch them.

### 2.2 The Priority Collision

Both findings converge on a single conclusion: **the bottleneck isn't evaluation accuracy — it's observability scope.**

| What we can observe well | What we can't observe |
|---|---|
| Task outcome quality (0.92% error) | Process compliance (19.7% gap in `good` sessions) |
| Binary pass/fail with uncertainty buffer | Reasoning quality (Layer 2 invisible) |
| Session status + verdicts | *Why* agents fail (thinking traces disabled) |
| Convention check results (when run) | Suppressed reasoning, Einstellung patterns |

This redirects the research priority from "make evaluation more accurate" (solved) to "expand what we can evaluate" (wide open).

### 2.3 Convention Compliance as the Missing Layer

EXP-147's unexpected finding — that 19.7% of `good` sessions have 3+ convention failures — creates a concrete gap between what the evaluator measures (outcome quality) and what conventions enforce (process quality). EXP-146's blockage means we can't yet study *why* agents violate conventions despite presumably knowing the rules.

**Connection:** H-105 predicts that thinking-trace analysis would reveal agents correctly reasoning about conventions in Layer 2 but failing to execute in Layer 3 (the externalization gap). If true, convention compliance failures are a *specific instance* of the reasoning externalization problem — and fixing them requires either Layer 2 monitoring or interventions that reduce Layer 2→3 compression loss.

---

## 3. Impact on Active Hypotheses

| Hypothesis | Prior | Impact | New Priority |
|---|---|---|---|
| **H-097** (CCC Triad) | 0.55 | P-120b leg healthy but moot. Track B (context isolation) now carries all remaining evidential weight. | **Track B is now the single most important CCC experiment.** |
| **H-105** (Three-Layer Model) | 0.72 | Untestable until infra change. But EXP-147's convention gap finding provides *indirect* support: the evaluator works at Layer 3 but misses process violations, consistent with layer-boundary information loss. | **Escalate infrastructure request.** |
| **H-102** (Workflow adoption) | 0.65 | Unaffected directly, but the convention compliance gap suggests workflow-embedded agents may have different process compliance rates. EXP-148 could add this as a secondary analysis. | Unchanged. |
| **H-103** (Format tax) | 0.60 | The evaluator's 3-way system is *less* format-constrained than binary — and it works better. Mild support for H-103 mechanism (less rigid formats preserve more information). | Unchanged. |

---

## 4. Proposed Priority Redirections

### Redirection 1: Convention Compliance Enforcement (NEW)
**What:** The 19.7% convention-failure rate in good-verdict sessions reveals an enforcement gap. The evaluator correctly ignores these (outcome ≠ process), but no system fills the gap.
**Action:** Consider a dedicated convention-compliance monitor separate from quality evaluation. This is a tractable engineering problem, not a research question.
**Priority:** Medium — it's operationally useful but doesn't advance theoretical understanding.

### Redirection 2: Escalate H-105 Infrastructure Unblock (URGENT)
**What:** H-105 is our highest-confidence untested hypothesis (P(H)=0.72) and the only one that could fundamentally change our approach to agent monitoring. The infra fix is <1 hour.
**Action:** Escalate to Hao: enable `thinkingLevel: "low"` for bob and may. Begin 1-week data collection immediately.
**Priority:** HIGH — this single change unlocks five blocked predictions and could redirect the entire guard/monitoring research program.

### Redirection 3: Track B as Sole CCC Validation Path
**What:** With P-120b moot, Track B (context isolation) carries all remaining weight for H-097. If Track B also shows null results, H-097 would need serious downward revision.
**Action:** Ensure Track B execution is clean and well-powered. Already dispatched to Coach at N=80.
**Priority:** HIGH — already in motion, just needs monitoring.

### Redirection 4: De-prioritize Evaluator Calibration Research
**What:** Any further work on evaluator accuracy improvements (conformal prediction, cross-validation, etc.) has minimal ROI. The evaluator is already at 99%+ for its intended scope.
**Action:** Archive P-120b research thread. Redirect budget to Track B and EXP-148.
**Priority:** Low effort, just housekeeping.

---

## 5. Ranked Findings by Impact/Novelty

1. **Evaluator is already 99%+ accurate** (HIGH impact, HIGH novelty) — Completely changes assumptions about the monitoring stack. We don't need better accuracy; we need broader scope.
2. **Convention compliance gap (19.7%)** (HIGH impact, MEDIUM novelty) — Identifies a concrete, actionable gap between quality evaluation and process enforcement.
3. **Thinking traces disabled system-wide** (MEDIUM impact, LOW novelty) — Important but not surprising; the key insight is that fixing it is trivial (<1 hour) and would unlock substantial research.
4. **3-way evaluator classification is a feature** (MEDIUM impact, HIGH novelty) — The `acceptable` category functions as built-in calibration. This is better than what we were trying to add.
5. **Quality ≠ process compliance** (LOW impact, MEDIUM novelty) — Conceptually important distinction, operationally already handled correctly by the evaluator.

---

## 6. Next Steps

1. **Immediate:** Escalate `thinkingLevel` enable to Hao (blocks H-105, our most promising untested hypothesis)
2. **This week:** Monitor EXP-147 Track B execution (the sole remaining CCC validation path)
3. **After Track B results:** Synthesize full H-097 assessment — if Track B null, revise H-097 downward significantly
4. **When thinking enabled:** Launch EXP-146 Phase 1 — start with FM-3.3 verification failures (highest base rate, most relevant to current guard research)
5. **Background:** Consider convention compliance monitor as a separate system (not evaluator-integrated)

---

*This synthesis covers both successful (EXP-147 Track A) and failed (EXP-146, auth error) threads. The EXP-146 findings referenced here come from the pre-existing results.md written by Coach before the auth failure blocked the integration thread.*
