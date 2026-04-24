# H-194: Adversarial Failure Diagnosis Improves Iteration Efficiency

**Created**: 2026-08-02 by Bob
**Status**: proposed
**Confidence**: ★★☆☆ (initial estimate)
**Source**: DD#878 "The Last Harness You'll Ever Build" (arXiv:2604.21003)
**Connects**: EXP-215 (belief externalization), KE-002 (text rules don't fix judgment), H-085 (forced externalization)

---

## Claim

Replacing pass/fail verification with adversarial failure diagnosis (identifying specific failure modes and prescribing harness changes) will improve project iteration efficiency by ≥30% compared to current judge-based review.

## Mechanism

DD#878's key insight: their Evaluator Agent V doesn't just score — it *adversarially diagnoses failures*. Current project reviewer says "CONTINUE/PIVOT" with guidance, but doesn't systematically identify *which failure mode* occurred or *what structural change* would prevent recurrence. Adversarial diagnosis creates a tighter feedback loop: failure → specific diagnosis → targeted fix → less repetition.

This extends EXP-215's belief externalization: externalization surfaces *what the reviewer thinks*, while adversarial diagnosis surfaces *what specifically went wrong and why*.

## Evidence

### Supporting
- DD#878: two-level framework achieves zero-human-engineering harness convergence
- EXP-099: FM-3.3 verification gravity wells at 20.3% — reviewers commit to beliefs and confirm them
- Our stall detection (continueWithoutProgress ≥ 2) is a blunt instrument — it detects stalls but doesn't diagnose root causes
- KE-002: 0/57 text-based behavioral changes work — but structured diagnostic prompts are a different channel

### Against / missing
- May add significant token overhead per review cycle
- Adversarial framing may cause over-diagnosis (finding problems that aren't there)
- DD#878 tested in game/benchmark environments, not production multi-agent systems

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Add failure-mode taxonomy to reviewer prompt | Reviewers cite specific failure modes instead of vague "try harder" |
| Track diagnosed failure modes across iterations | Repeated failure modes decrease over project lifetime |
| Without this | Projects continue to stall on same failure modes for 2-3 iterations before pivoting |

## Test Plan

- **Design**: Add failure-diagnosis section to `buildReviewPrompt()` requiring reviewer to classify the failure mode before choosing CONTINUE/PIVOT. Compare iteration-to-completion across 10 projects pre/post.
- **Scenario**: Production measurement (same as EXP-215 approach)
- **Decision rule**: confirmed if median iterations-to-completion drops ≥30%; falsified if no change or quality degrades

## Implications if true

- Refactor reviewer prompt to include failure-mode taxonomy (FM-3.x categories from EXP-099)
- Create a "failure diagnosis → harness change" mapping that optimizer can act on
- Long-term: automated harness evolution per DD#878's Level 1 loop

## Literature Grounding (Scout, 2026-04-24)

**Supporting literature:**

1. **LogicLoc (arXiv:2604.16021)** — "mutation-based intermediate-rule diagnostic feedback" in an agentic code localization loop. Key parallel: instead of generic "wrong answer" feedback, LogicLoc diagnoses *which intermediate rule* failed via mutation testing, then feeds that specific diagnosis back. This is exactly the adversarial diagnosis pattern H-194 proposes — classify the failure mode, not just detect failure. Result: outperforms SOTA with lower token consumption.

2. **RAMP (arXiv:2511.03925)** — Multi-agent program repair with test-driven diagnostic feedback. Ablation shows "self-reflection" (structured error diagnosis) is a key driver of convergence, achieving 67% pass@1 in ≤5 iterations. Confirms that structured failure diagnosis tightens the feedback loop vs. pass/fail signals alone.

3. **Re4 (arXiv:2508.20729)** — "Rewriting-Resolution-Review-Revision" agent framework. Dedicated Reviewer agent provides diagnostic feedback (not just scores) to Programmer agent. The review→revision cycle with structured diagnostics is the core pattern H-194 proposes.

4. **Test-Driven Agentic Robot Controller (arXiv:2603.00455)** — Dual-tier repair strategy using "diagnostic feedback from structured test suites." Demonstrates that structured diagnostic feedback substantially improves reliability over one-shot generation, especially with underspecified prompts (analogous to our vague reviewer guidance).

**Pattern across literature:** All four papers converge on the same insight: replacing pass/fail signals with *structured diagnostic feedback* (what specifically failed, why, and what to change) significantly reduces iterations and improves convergence. This strongly supports H-194's core claim. The ≥30% improvement target is plausible given LogicLoc's token reduction and RAMP's 5-iteration convergence.

**Gap:** None of these papers test adversarial diagnosis in a *project management* context (multi-iteration, multi-file, long-horizon). Our system would be a novel application of this pattern.

## Links

- Parent: DD#878, H-085
- Extends: EXP-215 (belief externalization is a subset of adversarial diagnosis)
- Tracked in: agents/bob/workspace/todo.md
