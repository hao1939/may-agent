<ai_context>
summary: "DistDebug-Bench separates finding a relevant file from diagnosing the causal code: across its 120 real distributed-system incidents, leading configurations reached roughly 85% file coverage but at most 72.6% root-cause-block coverage, with substantial run-to-run instability. The reusable implication is to score causal blocks, precision, and repeated-run consistency separately from broad localization or patch success."
triggers: ["DistDebug-Bench", "agent debugging evaluation", "causal block localization", "distributed systems debugging", "diagnosis precision", "debugging nondeterminism"]
last_updated: "2026-11-13"
source_basis: "HN item 50478672, complete DistDebug-Bench paper PDF text, project website, and OrderLab/distdebug-bench README at revision c3e929b9ee0082345337358e352ae37fc472df4c. Scout did not run the benchmark, agents, scorer, tests, released traces, or independently validate labels or reported results."
</ai_context>

# Agent debugging evaluation needs causal-block and stability receipts

**Date:** 2026-11-13  
**Disposition:** New source-grounded finding  
**Coverage:** Complete 41-page paper text, project website, and pinned repository README; no benchmark or agent execution

## Question

What does DistDebug-Bench reveal that file-level localization or patch-based
coding-agent evaluation can hide?

## Source observation

[HN item 50478672](https://news.ycombinator.com/item?id=50478672) linked
[DistDebug-Bench](https://distdebug.com/). The item had one point and no comments
when inspected, so HN is discovery evidence rather than independent validation.
The substantive evidence is the producer-authored paper, website, repository,
and released benchmark artifacts.

DistDebug-Bench gives an agent an issue report, attached logs or stack traces,
and a pre-fix repository snapshot, then asks for the source blocks that caused
the failure. Its 120 incidents come from 11 distributed systems in five
languages. The paper reports 219 labeled root-cause blocks; 45.8% of incidents
need multiple blocks, nearly a quarter cross files, 68.3% do not name the gold
method in the report, and 75 of 120 lack a usable project-internal stack trace.
Three annotators independently labeled each accepted issue and reconciled a
final minimal pre-fix causal span.

The useful result is a **granularity gap**. The highest-scoring configuration in
the reported common sweep reached 86.1% file coverage but 72.6% block coverage.
Across the reported configurations, the file-to-block gap was 13–22 percentage
points. Broad predictions can also trade coverage for precision: one reported
configuration reached 70.0% block coverage while its block precision was 37.3%
and it named 3.6 blocks per diagnosis on average. Reaching the component is
therefore not the same as explaining the failure precisely.

The benchmark also preserves instability rather than averaging it away. Each
bug/configuration pair has three schema-valid attempts. The repository summary
reports that 12–30% of bugs, depending on configuration, had more than a
20-point block-coverage spread across those attempts. The paper associates the
hardest cases with weak report anchors, cross-component symptoms, early
commitment to a plausible local explanation, and inconsistent tool-search
scope. These observations support repeated-run diagnosis checks; they do not by
themselves prove a universal cause of debugging failure.

## Reusable implication

Agent debugging evaluation should retain at least four distinct receipts:

1. **Search reach:** whether the run reached the correct file and function.
2. **Causal localization:** coverage of the independently labeled root-cause
   blocks, including every block in multi-block and cross-file failures.
3. **Diagnostic precision:** how much nominated code is actually causal, so a
   broad list cannot masquerade as a precise diagnosis.
4. **Stability:** per-incident results across repeated attempts, with large
   spreads and hypothesis changes visible instead of only an aggregate mean.

Patch success is a separate downstream receipt. A passing patch can suppress a
symptom, and a plausible diagnosis can still blame the wrong intervention
point. For difficult incidents, a useful run artifact should therefore bind the
observed symptom, competing hypotheses, evidence inspected, rejected
hypotheses, nominated causal blocks, and any later repair to the same incident
identity. This makes tunnel vision and unsupported search expansion reviewable.

## Evidence limits

The incidents are selected historical bugs with fixes sufficiently local to
support causal labeling; large or ambiguous refactors were excluded. That
selection enables precise scoring but may underrepresent failures whose causes
are organizational, environmental, configuration-dependent, or broadly
distributed. Public historical bugs also create memorization risk. The authors
remove future commits, anonymize workspaces, block network access, scan traces
for issue and fix identifiers, and report closed-book probes, but acknowledge
that pretraining exposure cannot be ruled out.

Block labels encode the authors' reconciled minimal causal regions, not every
plausible repair or intervention point. The paper's metric-validity audit found
a small set of missed blocks that reviewers considered correctly localized at
a different point, so block coverage is informative rather than a complete
semantic oracle. The reported model, harness, token, and provider comparisons
also mix rapidly changing systems and should not be read as durable model
rankings.

Scout read the complete paper text and pinned README but did not run the
benchmark, inspect all 6,120 released traces, recompute tables, validate
annotations, execute tests, call models, or reproduce the repair pilot.

## Primary evidence

- **HN:** https://news.ycombinator.com/item?id=50478672
- **Source:** https://distdebug.com/
- **Paper:** https://distdebug.com/assets/paper.pdf
- **Repo:** https://github.com/OrderLab/distdebug-bench
- **Reviewed revision:** `c3e929b9ee0082345337358e352ae37fc472df4c`
- **Dataset:** https://huggingface.co/datasets/OrderLab/distdebug-bench
- **Released traces:** https://huggingface.co/datasets/OrderLab/distdebug-bench-traces
