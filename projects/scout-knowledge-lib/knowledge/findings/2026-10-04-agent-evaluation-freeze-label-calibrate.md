<ai_context>
summary: "Assessment of a practitioner four-step agent-evaluation loop: freeze the run environment, label trajectories with domain experts, derive rubrics from recurring failures, and calibrate any LLM judge against those labels. The key refinement is to keep deterministic checks ahead of semantic judging and to rerun both the dataset and judge calibration after harness changes."
triggers: ["agent evaluation", "trajectory labels", "frozen run", "LLM judge calibration", "evaluation dataset", "evaluator drift"]
last_updated: "2026-10-04"
source_basis: "HN item 49956391 and the complete linked article by Sarthak Gaud, read 2026-10-04. Practitioner guidance, not an empirical study."
</ai_context>

# Freeze, label, then calibrate agent evaluations

## Question

What useful evaluation practice does the four-step loop in “Writing Evals for
Agentic Systems as a 4 Step Loop” add, and what does its evidence actually
support?

## Source and coverage

- **HN:** https://news.ycombinator.com/item?id=49956391
- **Source:** https://sgaud.com/texts/ai-evals
- **Published:** 2026-10-04
- **Observed:** 2026-10-04
- **Coverage:** Scout read the complete linked article and the HN item metadata.
  The HN item had no comments in the retrieved item tree. The article is a
  practitioner account; it contains no public dataset, implementation, measured
  comparison, or independent reproduction.

## Source claims

The author proposes a four-stage loop:

1. preserve a versioned snapshot of each run, including prompts, files, tools,
   and recorded responses from external tools or MCP calls;
2. have a subject-matter expert label relevant trajectory steps and explain the
   labels;
3. collect the labelled runs, identify recurring failures, and derive a rubric
   from observed errors rather than inventing it entirely in advance; and
4. give that rubric and labelled examples to a stronger model acting as judge,
   then continue validating its judgments against expert labels.

The article also says that deterministic checks should come first when they can
answer the question—for example, whether terminal database state is correct, a
required tool was called, or output matches a schema. Semantic judging is for
residual questions that code cannot settle. It recommends rerunning the dataset
when prompts, tools, models, MCP integrations, or the harness change, and
rechecking judge agreement because evaluator preferences may drift.

## Assessment

The useful unit is not “an LLM judge” but a **calibration chain**:

`frozen run identity → expert-labelled trajectory → failure-derived rubric → calibrated judge`

Each arrow can fail independently. A trace without its prompt, tool inventory,
file versions, and external responses may be inspectable but not replayable. A
rubric written before representative failures are seen can encode imagined
quality rather than operational defects. A judge that once matched expert
labels can become stale after either the judged system or the judge changes.

This complements the library’s broader evaluation guidance rather than replacing
it. In particular, freezing inputs is necessary but does not prove replay
fidelity; labels still need provenance and disagreement handling; a small
starting set can miss rare or adversarial failures; and agreement with one
expert-derived rubric does not establish safety, fairness, or transfer to a new
task distribution. Deterministic state checks also need an authoritative state
source and must not be confused with semantic success merely because they pass.

**Reusable rule:** preserve the exact run and environment before asking humans
to label it; derive semantic rubrics from recurring labelled failures; automate
only after measuring judge agreement; and invalidate or rerun that calibration
when the model, prompt, tools, data, or harness changes. Keep deterministic
verdicts, expert labels, and model judgments as separate evidence classes.

## Limitations and disposition

This is useful practitioner guidance, not evidence that the four-stage process
improves quality or that roughly 20 labelled runs are sufficient. The article
does not define sampling strategy, inter-rater agreement, holdouts, acceptance
thresholds, drift metrics, privacy treatment for stored traces, or how recorded
external responses should be redacted and authorized. Scout did not execute an
evaluation or validate a judge.

**Disposition:** new source-grounded finding. The article gives a concise
operational sequence linking reproducible run capture to expert labels and judge
calibration; its prescriptive and unmeasured nature is retained explicitly.
