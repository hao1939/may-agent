<ai_context>
summary: "A current HN-linked evaluation essay separates deterministic verifiers, instance-specific rubrics, and pairwise preference by what the task permits, then shows why overall judge agreement is insufficient: asymmetric false-pass and false-fail rates can materially bias the reported pass rate. Its numerical correction is an illustrative worked example, not an experiment."
triggers: ["Verifiers First Rubrics Second", "grader selection", "judge calibration", "true positive rate", "true negative rate", "Rogan-Gladen correction", "HN 50110814"]
last_updated: "2026-10-16"
source_basis: "HN item 50110814 and Rodney L.'s complete linked essay, published 2026-10-11 and retrieved 2026-10-16. Scout read the essay and reference list but did not inspect its cited papers, reproduce their results, or run an evaluation."
</ai_context>

# Choose the grader from the task, then correct for judge error

## Question

What does the HN-linked essay “Verifiers First, Rubrics Second” add to Scout's existing guidance on deterministic checks, failure-derived rubrics, and calibrated model judges?

## Source and coverage

- **HN:** https://news.ycombinator.com/item?id=50110814
- **Source:** https://rlafuente.com/posts/2026-10-11-agent-evals-4-verifiers-first-rubrics-second.html
- **Published:** 2026-10-11
- **Observed:** 2026-10-16
- **Retrieved page SHA-256:** `b2f3aac080283e51f52a624f60ccd82171584944b2be80a030977864b56a3bb6`
- **Coverage:** Scout read the complete linked essay, its worked example, and its reference list. The HN item had one point and no comments in the retrieved item tree. Scout did not open the cited papers, reproduce their reported results, or validate the essay's literature synthesis.

## Source claims

The author proposes selecting a grader from the structure of the task:

1. use a deterministic verifier when success can be computed from end state;
2. use an instance-specific, nearly binary rubric when experts can decompose the remaining judgment; and
3. use pairwise preference for genuinely holistic quality, while controlling position, length, and self-preference biases.

The essay argues that executable correctness should gate semantic quality rather than be blended with it. In its fictional refund example, database-state checks first establish whether the refund was correctly issued. Only passing trials reach a four-criterion model-judged rubric about the customer reply. The rubric is derived after a support lead reads real replies, not written entirely before observing failures.

The sharper addition is the calibration treatment. The author says a judge's overall agreement with people is not enough because false accepts and false rejects have different operational consequences. The worked example labels 50 replies and gives the judge a true-positive rate of 0.97 but a true-negative rate of 0.67. Applying the Rogan–Gladen screening-test correction to a judge-reported 75% pass rate produces an estimated human pass rate near 65%. Those numbers are explicitly made up for the example; they demonstrate the calculation, not measured judge performance.

The essay also warns that deterministic verifiers have error rates. It recommends estimating false-pass and false-fail rates on labelled samples, checking whether the agent can reach or game the verifier, keeping a human-graded holdout during optimization, and recalibrating after the system changes.

## Assessment

Scout already records the sequence `frozen run → expert labels → failure-derived rubric → calibrated judge` in [Freeze, label, then calibrate agent evaluations](./2026-10-04-agent-evaluation-freeze-label-calibrate.md). This source adds two useful decisions that the earlier note does not make explicit:

- **grader selection is a task-property decision:** deterministic state first, decomposable residual quality second, pairwise preference only when a checklist would distort the target; and
- **judge calibration needs a confusion matrix, not just agreement:** report sensitivity and specificity—or equivalent class-conditional error rates—because a lenient judge can agree often while inflating pass rates.

A practical evaluation receipt should therefore keep at least: verifier identity and coverage, false-pass and false-fail estimates, rubric version and derivation sample, judge identity, labelled holdout composition, confusion counts, correction method, uncertainty, and the population to which the correction is applied. Correcting a point estimate does not make sparse labels precise: in the essay's own example, the true-negative estimate rests on only twelve human-negative cases.

**Reusable rule:** route each claim to the cheapest grader that can actually decide it, gate semantic scoring on deterministic correctness when appropriate, and calibrate model judges with class-conditional errors on a held-out human-labelled sample. Never promote an illustrative corrected rate into measured evidence, and never report a corrected point estimate without its label counts and uncertainty.

## Limitations and disposition

This is a practitioner synthesis, not a new empirical study. Its benchmark statistics come from cited work that Scout did not independently inspect in this scan, and its support-workflow numbers are fictional. The essay does not specify a universal sample size, correction interval, prevalence-shift treatment, multi-rater protocol, or method for dependent rubric criteria. The HN discussion supplies no community validation.

**Disposition:** new source-grounded finding. It complements rather than duplicates the existing calibration-chain note by making grader choice and asymmetric judge-error correction explicit while retaining the essay's evidential ceiling.
