<ai_context>
summary: "SciResearch-Eval's abstract reports that autonomous experimental agents can execute procedures yet remain severely overconfident when a supplied simulator is physically wrong. The reusable evaluation pattern is to test scientific agents under deliberately misspecified tools, score calibrated intervals against exact ground truth, and distinguish naming the fault from designing experiments that remain valid despite it. Scout reviewed only the complete arXiv API abstract and metadata, not the paper, environment, tasks, graders, code, episode records, or statistical analysis."
triggers: ["SciResearch-Eval", "experimental agents", "model misspecification", "scientific judgment", "calibrated intervals", "flawed simulator"]
last_updated: "2026-11-17"
source_basis: "One bounded arXiv cs.AI Atom request returned HTTP 200 in 289 ms with one request and no Retry-After value. Assessment is limited to the complete API abstract for arXiv:2611.21541v1; the full paper and artifacts were not reviewed."
</ai_context>

# Experimental Agents Need Model-Misspecification Tests, Not Just Procedural Traps

**Question:** What does the current arXiv signal add to evaluating autonomous experimental agents?

**Observation date:** 2026-11-17  
**Disposition:** New knowledge  
**Coverage:** Complete title, metadata, comment, and API abstract only; the full paper and released environment were not reviewed.  
**Source:** https://arxiv.org/abs/2611.21541v1  
**Reviewed version:** `2611.21541v1`

## Source observation

*SciResearch-Eval: Evaluating Scientific Judgment in Autonomous Experimental Agents* introduces an interactive thermal-measurement benchmark. An agent chooses heating experiments, uses a supplied heat-conduction simulator, and reports material properties with 95% intervals. The simulator may be under-resolved or physically wrong, while the benchmark has exact ground truth.

The abstract reports a held-out evaluation of 93 tasks, nine models, and 2,511 episodes. According to that abstract:

- models generally handle procedural traps;
- when the simulator omits physics, most models report wrong values while claiming 95% confidence, with interval coverage of 20–62%;
- the reported coverage is 94% for GPT-6 Astra and 99% for Claude Fable 5.2;
- at default effort, selected Claude 5.5 models seldom diagnose the missing physics, while Astra and Fable sometimes design gentler-heating experiments where the flawed simulator remains accurate;
- simply requesting wider intervals does not materially repair coverage;
- asking agents to state their strategy improves interval scores by a reported 1.6–2.5 times on a preregistered fresh split, while coverage barely changes; and
- a preregistered effort ablation reports a large Opus improvement at maximum effort, but at 13–31 times more reasoning, with older and open-weight models not benefiting.

These are producer-reported abstract claims. The reviewed text does not expose task construction, model versions beyond the named labels, per-condition sample sizes, scoring equations, confidence intervals, prompts, simulator defects, episode traces, or the released artifacts' contents.

## Reusable finding: evaluate whether agents can survive a wrong tool

Scientific-agent evaluation should test more than whether the agent follows a procedure or notices an obvious trap. The harder boundary is whether the agent treats a computational tool as a fallible model and can obtain a valid answer when that model is misspecified.

A useful evaluation separates at least four capabilities:

1. **Fault diagnosis:** Does the agent identify that the simulator or measurement model is wrong?
2. **Robust experimental design:** Can it choose an operating regime where the available model remains sufficiently accurate, even without naming the defect?
3. **Uncertainty calibration:** Do reported intervals contain the exact value at the promised frequency, rather than merely becoming wider or more verbose?
4. **Resource-aware correction:** Does additional reasoning materially improve validity, and at what token, time, or experiment cost?

This distinction matters for general agent runtimes. A tool can execute successfully, return plausible numbers, and still encode the wrong world. Tool-call success, procedural compliance, self-reported confidence, and even explicit fault diagnosis are therefore insufficient receipts. High-stakes runs need outcome checks against independent observations or known-ground-truth test cases, plus an inconclusive or escalation state when model adequacy is unresolved.

The abstract also suggests that **diagnosis and robustness are different competencies**. An agent may remain calibrated by choosing experiments inside a simulator's validity envelope without articulating the missing physics. Conversely, correctly naming a flaw does not guarantee that its final interval covers the truth. Evaluations should score the chosen experiment, final estimate, interval calibration, diagnosis, and cost separately rather than collapsing them into one success label.

## Relationship to existing Scout knowledge

This complements [LabBench separates scientific interpretation from choosing the next experiment](./2026-09-30-labbench-scientific-decision-benchmark.md). LabBench asks whether an agent can commit to an informative next experiment from held-out laboratory records. SciResearch-Eval adds a distinct failure mode: the agent's supplied analysis tool can be physically wrong, so the experiment must either expose the mismatch or remain valid despite it.

Together they support evaluations that separate evidence interpretation, experiment selection, model-adequacy testing, calibrated estimation, and resource cost. The subjects are not duplicates: LabBench's reviewed evidence concerns decision quality over proprietary wet-lab records, while this record concerns abstract-reported calibration under a deliberately flawed simulator with exact ground truth.

## Possible relevance to May

For an agent platform, an analogous evaluation would give an agent a deterministic but selectively stale, incomplete, or misspecified helper and test whether it blindly trusts successful outputs, detects the mismatch, chooses a safer probe, or returns an explicit inconclusive result. The key metric should be correctness and calibration against an independent oracle, with reasoning and tool costs reported separately. This is an investigation candidate, not evidence that SciResearch-Eval transfers directly to software-agent operations.

## Retrieval evidence

The workflow supplied one bounded request to:

`https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`

The request returned HTTP `200` in `289 ms`; request count was `1`. `Retry-After` was unavailable (`null`), and no deferred retry time was supplied. Scout made no retry, pagination request, fallback request, or query variant.

## Evidence limitations

- Scout reviewed only the complete Atom abstract and metadata for `2611.21541v1`, not the 28-page paper, environment, graders, harness, simulator, tasks, code, leaderboard, prompts, episode records, figures, tables, or statistical analysis.
- All benchmark counts and comparative results above are author-reported and were not independently reproduced.
- The abstract does not provide enough detail to assess contamination, task diversity, repeated-run variance, grader validity, exact calibration methodology, or whether the simulator faults represent real scientific-model failures.
- Named model comparisons may bundle model, effort, harness, prompt, and token-budget differences. The abstract itself notes a substantial token-cost difference for Fable 5.2.
- Coverage on a benchmark with exact synthetic or simulator-derived ground truth does not establish scientific reliability in open-ended physical laboratories.
- The runtime implications and May application above are Scout's interpretation. The abstract does not evaluate software-agent control planes or prove that independent oracles and inconclusive states are sufficient controls.
