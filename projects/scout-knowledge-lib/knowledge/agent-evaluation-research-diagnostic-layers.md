<ai_context>
summary: "Third companion note to agent-evaluation.md containing the cohesive §37–§43 diagnostic-layers block from August–September 2026. Separates candidate supply from answer selection, answer correctness from trace integrity, implementation readiness from blocker localization, AI-AI coordination from human convention recovery, detected trace patterns from causal attribution, answer-level forgetting from deployment-wide secret leakage, and aggregate scores from uncertainty-aware domain estimates under sparse labels."
triggers: ["agent evaluation diagnostic layers", "candidate supply", "answer selection", "judge reliability", "selection loss", "fixed candidate pools", "trace integrity", "CAIT Rate", "execution contract", "answer-trace consistency", "structured-data agent", "IdeaAMBIG", "codification readiness", "specification gap", "defect localization", "clarification action", "convention gap", "implicit communication", "human-AI compatibility", "Hanabi", "Off-Belief Learning", "partner legibility", "failstep", "failure diagnosis", "causal attribution", "deterministic detectors", "trace normalization", "K-Bench", "agentic unlearning", "K-Score", "deployment-wide leakage", "tool-observation leakage", "disaggregated evaluation", "prediction-powered smoothing", "small area estimation", "domain mean", "interval coverage", "reporting taxonomy"]
last_updated: "2026-09-20"
source_basis: "Extracted intact from agent-evaluation-research-beyond-outputs.md §37–§40 on 2026-09-11 after the block grew into a reusable August–September companion. §37 derives from arXiv 2608.25937; §38 from the arXiv API and full HTML for 2608.26036; §39 from the arXiv API and full HTML for 2609.10539; §40 from the arXiv API and full HTML for 2609.11489. §41 adds static GitHub inspection of AbdelazizBs/failstep pinned at 09166c7cc356bd1f7c96b1bd54b34d82d7c2d581; repository code was not executed. §42 derives from the arXiv API abstract for K-Bench (2609.12808v1). §43 derives from the live arXiv API abstract for prediction-powered smoothing and validation (2609.20758v1)."
parent_note: "agent-evaluation.md"
previous_companion: "agent-evaluation-research-beyond-outputs.md"
</ai_context>

# Agent Evaluation Research: Diagnostic Layers (August–September 2026)

**Third companion to [Agent Evaluation Patterns](./agent-evaluation.md)** — this note
continues [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md#36-the-diagnostic-architecture-crisis--evaluation-as-infrastructure-hnarxiv-june-2026),
which covers §23–§36 and establishes why evaluation must inspect the substrate rather
than only terminal outputs.

This note covers §37–§43: seven diagnostic layers that localize where apparently
successful agent behavior can fail — candidate selection, computational trace,
specification readiness, partner-legible convention recovery, the boundary
between detected trace patterns and causal attribution, secret leakage outside
the final-answer channel, and domain-level uncertainty hidden by aggregate scores.

---

## §37 The Candidate-Selection Bottleneck — Correct Answers Can Be Generated Then Lost (2026-08-27)

**Candidate supply and answer selection shape the value of LLM judging in
multi-agent systems** ([2608.25937](https://arxiv.org/abs/2608.25937)) isolates
three stages that aggregate accuracy normally conflates: generating candidate
answers, recognizing candidate correctness, and choosing the final answer.
Its central observation is that a multi-agent system can already contain a
correct answer yet converge on and report a wrong one. More generation is
therefore not automatically useful: it matters whether extra samples make the
correct answer present, sufficiently frequent, or recognizable to the selector.

The authors first map judge reliability on 15,336 questions from MMLU-Pro,
GPQA, MedXpertQA, and MuSR, with Humanity's Last Exam analyzed separately.
They then replay 81,390 fixed candidate pools drawn from 16,278 questions
across five benchmarks. Holding the candidate pools fixed is the important
evaluation move because it changes terminal selection without silently changing
generation or communication. In these replays, combining candidate frequency
with an LLM judge's evaluation raises reported accuracy from **63.82% to
70.82–70.95%**, primarily by recovering correct candidates that popular wrong
answers had outnumbered. Judge reliability is not a stable model attribute: it
varies with task, generator, and the rarity of the correct answer.

This suggests a four-part evaluation decomposition for multi-agent reasoning:

1. **Supply/oracle coverage:** did any agent generate a correct candidate?
2. **Recognition:** can the judge distinguish that candidate under this task,
   generator mix, and candidate-frequency regime?
3. **Selection loss:** how often is a present correct answer discarded?
4. **Reported accuracy:** what answer does the terminal policy finally expose?

A system that reports only the fourth number cannot tell whether it needs a
better generator, a better judge, or a different selection rule. Majority
agreement is especially unsafe without quality control because repeated errors
can create popularity without correctness. Conversely, judge-only selection
misses the useful prior carried by candidate frequency. The practical design
pattern is to retain candidate-level provenance and replay fixed pools when
comparing selectors, rather than rerunning the whole system and attributing a
stochastic outcome change to the selection policy.

**Boundary:** these are preprint results over the reported benchmark and
candidate-pool construction. The abstract does not establish that the same
frequency-plus-judge rule transfers unchanged to open-ended tasks or correlated
agents; the reusable result is the evaluation decomposition and fixed-pool
replay method, not a universal voting formula.

Source: https://arxiv.org/abs/2608.25937

---

## §38 Trace Integrity — A Correct Answer Can Rest on an Invalid Computation (2026-08-27)

**Trace Integrity for LLM Data Agents** ([2608.26036](https://arxiv.org/abs/2608.26036))
separates answer correctness from whether the recorded computation actually
supports that answer. For structured-data agents, an executable SQL query is
not enough: it can run successfully while using the wrong join, filter,
aggregation, grouping key, sort, limit, or schema binding. A fluent rationale
is also insufficient because it does not specify an operator-level program that
can be replayed.

The paper proposes an **execution contract** that binds user intent to schema
elements, assumptions, an operator plan, executable queries, verification
status, and the final answer. Its seven integrity dimensions are: explicit,
executable, schema-valid, operator-faithful, replayable, answer-consistent, and
auditable. The useful metric is **CAIT Rate** (Correct Answer / Invalid Trace):
among benchmark-correct answers, the fraction whose recorded computations fail
trace integrity. This exposes hidden successes that answer-only scoring would
credit.

In a scoped proof of concept on 100 BIRD Mini-Dev examples, Direct SQL,
Operation Summary + SQL, and Contract-First SQL reached answer accuracies of
20%, 22%, and 24%, respectively. Their trace-integrity pass rates were 39%,
43%, and 40%, while CAIT rates were 55%, 59.1%, and 45.8%. The rankings do not
move together: the method with the highest trace pass rate also had the highest
share of correct answers resting on invalid traces. Across all 300 predictions,
17% did not execute, but the validator also found less visible operator and
answer-trace mismatches among executable outputs.

This extends the note's beyond-output thesis into a practical evaluation
contract. A structured-data agent should report at least four distinct signals:

1. answer accuracy against the reference result;
2. execution success;
3. trace-integrity pass rate with localized operator failures; and
4. CAIT Rate for silent, computationally unsupported successes.

The trace should be retained as a regression object, but only at the level of
computational commitments; this does not require exposing private chain of
thought or unrestricted data snapshots. A valid trace also does not certify the
quality, fairness, or appropriateness of the underlying data.

**Boundary:** this is a vision paper with one 100-example, one-model experiment
(Claude Haiku 4.5), not a broad benchmark. The deterministic validator compares
against normalized gold traces and can reject semantically equivalent SQL that
it cannot prove equivalent; BIRD questions may also admit multiple valid
programs. CAIT should therefore be treated as a diagnostic signal, not a final
semantic judgment or stable model ranking.

Source: https://arxiv.org/abs/2608.26036  
Source: https://arxiv.org/html/2608.26036  
Source: https://export.arxiv.org/api/query?id_list=2608.26036

---

## §39 The Gap-Localization Bottleneck — Agents Clarify Better Than They Diagnose (2026-09-10)

**IdeaAMBIG** ([2609.10539](https://arxiv.org/abs/2609.10539)) evaluates whether
models can tell when a research-method specification is ready to implement,
locate the implementation-critical gap, and formulate a useful clarification.
Its 660 evidence-grounded records pair 163 real gaps recovered from
reproducibility reports and resolved GitHub issues with 497 controlled defects
in codification-ready specifications. The benchmark excludes environment,
resource, runtime, and credential problems so that it targets unresolved
method choices rather than generic execution friction.

Across 13 models, the strongest reported model illustrates a sharp capability
split on real-world records:

- codification-readiness assessment reaches **67.5 Macro-F1**, but accepts 31%
  of underspecified inputs and rejects 34% of ready ones;
- exact blocker localization reaches only **16.0% Loc-Acc** and **9.6 Macro
  Defect Recovery Rate**;
- once given the annotated blocker, clarification reaches **80.6 Macro
  Clarification Action Success**, versus **13.6** when the model must discover
  the blocker itself.

This is not merely a taxonomy-scoring artifact. On 50 real-world cases,
removing the required defect labels raises same-blocker identification from
10% to 40%, but still leaves most blockers undiscovered. Human ML researchers
also find localization harder than the other tasks: on the sampled real-world
records they score 91% for readiness, 52% for defect recovery, and 90% for
clarification. The hard operation is therefore identifying the unresolved
method-defining decision, especially when the defect is a local ambiguity
inside an otherwise detailed method rather than a wholly missing component.

The downstream studies expose why executable success is an inadequate proxy
for faithful implementation. With gold defect information and resolution,
GPT-5.6-Sol raises codification-ready specifications from **14% to 98%** on 50
paired real-world cases. On 20 bounded components from projects with reference
implementations, gold-resolved specifications raise all-tests-passing from
45% to 85% and target-method fidelity from 30% to 90%. In the direct condition,
70% of generated components run but only 30% implement the reference method
detail: a plausible unsupported default can execute cleanly.

This extends the beyond-output evaluation stack with a **pre-execution
specification gate**:

1. assess readiness separately from implementation success;
2. require the evaluator to name the exact unresolved decision, not just a
   broad ambiguity category;
3. route a known blocker to a person or source artifact for clarification;
4. evaluate generated code for both test passage and fidelity to the resolved
   method choice.

The operational implication is counterintuitive: generic prompts that tell an
agent to “ask clarifying questions” target the capability models already show.
The weak link is supplying a reliable gap detector. Review workflows should
therefore spend their scarce expert attention on blocker discovery and use
models to turn confirmed blockers into precise questions or evidence requests.

**Boundary:** IdeaAMBIG is a September 2026 preprint concentrated in AI/ML,
mostly uses evidence-resolved single-defect specifications, and evaluates
one-step clarification. The oracle studies provide gold resolutions, so they
measure the upper-bound value of successful clarification rather than an
end-to-end autonomous research workflow. The executable validation covers 20
bounded components, not full paper reproductions.

Source: https://arxiv.org/abs/2609.10539  
Source: https://arxiv.org/html/2609.10539v1  
Source: https://export.arxiv.org/api/query?search_query=all:%22AI%20agent%22%20OR%20all:%22agentic%22&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

---

## §40 The Convention Gap — AI-AI Performance Can Miss Human Coordination (2026-09-11)

**The Convention Gap** ([2609.11489](https://arxiv.org/abs/2609.11489))
measures how much cooperative success comes from meaning that is not present in
literal communication. For each action, it computes failure probability from
literal information alone, then subtracts the observed failure rate. A positive
gap therefore identifies coordination supported by an implicit convention,
rather than simply rewarding a high task score.

Hanabi makes this unusually measurable: the finite deck and deterministic hint
rules permit an exact posterior over whether a played card should fail from its
literal hints. Replaying roughly 101,000 play actions across public human-human,
AI-AI, and human-AI datasets produced gaps of **+26.2 percentage points**, **−0.7
pp**, and **+16.4 pp**, respectively. The human-pair signal concentrated on
cards that had received no hints (**+46 pp**), precisely where literal evidence
was weakest and convention use should matter most.

The partner-level result shows why ordinary scores are not a substitute. Across
three AI partners, humans faced similar literal predicted failure rates
(38–41%), yet their observed failure ranged from 14.4% to 34.4% and their gaps
from +24.1 to +6.2 pp. The partner eliciting the largest convention gap also
produced the fewest human failures. Meanwhile, aggregate game score shifted
with each corpus's player roster, whereas the gap separated human from AI play
at the agent level. A known-answer check strengthens the construct: five
Off-Belief Learning checkpoints with progressively restored convention content
rose monotonically from +1.6 pp at the convention-free level to +21.7 pp.

This adds a **partner-legibility layer** to agent evaluation. Self-play and
AI-AI cross-play test whether agents coordinate with agents that share their
representations; they do not establish whether a person can infer the agent's
intent. For human-agent workflows, evaluate at least three separate quantities:

1. task outcome or team score;
2. literal action risk, conditioned only on observable state and explicit
   communication; and
3. the residual between literal predicted risk and observed failure, stratified
   by partner type and communication scarcity.

The broader recipe is to identify consequential decisions, define the literal
state, build a failure predictor that deliberately excludes partner intent and
behavior, and compare predicted with observed failure. This makes the metric a
useful complement to §27's public/private channel divergence: §27 asks whether
an agent's own visible message differs from latent state, while the convention
gap asks whether a partner can reliably recover useful meaning beyond that
visible message.

**Boundary:** the exact estimator is specific to Hanabi. Other domains require a
new literal-information baseline, likely approximate and therefore separately
validated. Human-AI evidence covers only three AI types from one study; the
paper's additional LLM-agent checks do not replace broad human testing. The gap
is also not a training objective by itself—a reckless action that succeeds by
luck can increase it—so it must remain paired with outcome and safety metrics.

Source: https://arxiv.org/abs/2609.11489v1
Source: https://arxiv.org/html/2609.11489v1
Source: https://export.arxiv.org/api/query?id_list=2609.11489

---

## §41 The Diagnostic-Causality Boundary — A Detected Pattern Is Not Yet a Root Cause (2026-09-13)

A current GitHub implementation, [`AbdelazizBs/failstep`](https://github.com/AbdelazizBs/failstep), makes post-hoc agent-run diagnosis unusually inspectable. At the pinned revision it accepts native JSON/JSONL plus normalized OpenAI messages, LangChain intermediate steps, and exported OpenTelemetry GenAI JSON. Six deterministic detector modules emit evidence-linked findings for malformed output, schema mismatch, tool failure, repeated calls, timeout, and retrieval pathologies. The complete recursive tree contains 133 entries and is not truncated; it includes detector, parser, redaction, report, fixture, and test code rather than only a product description.

The useful pattern is **evidence abstention**. The implementation does not infer a schema error when the expected schema is absent, requires three consecutive tool calls with the same canonicalized arguments before labeling a retry loop, and omits duration evidence that was not present. Tests explicitly keep malformed-but-ambiguous output, interrupted repetitions, two-call retries, and healthy busy traces silent. Optional LLM analysis is disabled unless an endpoint is configured, runs only when no deterministic error exists, must attach its finding to actual step indexes, and accepts quoted evidence only when it can be found in the run. This is a practical alternative to asking a model for a free-form explanation of every failed trajectory.

But the code also reveals a boundary that diagnostic interfaces should expose. Findings are sorted by severity, then by a fixed detector order (`FS001` through `FS008`), then by first step. The first item in that ordering is assigned to `root_cause`; there is no causal graph, counterfactual replay, or proof that correcting that item would have prevented the run failure. A malformed output may be downstream of an earlier retrieval defect, while a timeout may be a symptom of repeated calls. The implementation provides good **pattern detection and localization**, but its `root_cause` field is a deterministic prioritization label rather than demonstrated causal attribution.

That distinction suggests a four-level contract for agent-run diagnostics:

1. **observation** — quote the trace field, step, and normalized value;
2. **pattern** — state the explicit detector predicate and threshold;
3. **priority** — disclose how competing findings are ranked;
4. **cause** — reserve causal language for replay, intervention, or other evidence that changing the candidate factor changes the outcome.

A deterministic detector can be more auditable than an unconstrained LLM without becoming a causal oracle. Evaluation systems should therefore retain detector identity, evidence, and ranking policy, and label an untested `root_cause` as a lead or primary finding. The same rule applies when normalized cross-runtime traces make many systems look comparable: format interoperability increases the supply of observable evidence, not the strength of causal inference.

**Boundary:** Scout inspected source and tests at one pinned revision but did not install the package or execute its suite. The repository was created on the day of inspection and had one GitHub star in the discovery response, so this is evidence of an implementation pattern, not adoption, effectiveness, or production maturity. Supported input formats are adapters with necessarily different source fields; normalization cannot recover evidence that an upstream runtime never recorded.

Repo: https://github.com/AbdelazizBs/failstep  
Pinned revision: https://github.com/AbdelazizBs/failstep/commit/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581  
README: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/README.md  
Diagnosis ordering: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/src/failstep/diagnose.py  
Detector registry: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/src/failstep/detectors/__init__.py  
Retry detector: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/src/failstep/detectors/retry.py  
Optional LLM boundary: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/src/failstep/llm.py  
Adversarial/abstention tests: https://github.com/AbdelazizBs/failstep/blob/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581/tests/test_detectors/test_traps.py  
Complete pinned tree: https://api.github.com/repos/AbdelazizBs/failstep/git/trees/09166c7cc356bd1f7c96b1bd54b34d82d7c2d581?recursive=1

---

## §42 The Forgetting-Certificate Boundary — A Clean Answer Can Hide Deployment Leakage (2026-09-14)

**K-Bench** ([2609.12808v1](https://arxiv.org/abs/2609.12808v1)) tests whether
model-level unlearning certificates survive agentic deployment. Conventional
benchmarks such as TOFU and MUSE inspect the final answer, so refusal can count
as forgetting. K-Bench instead treats a secret as leaked when it appears in any
of six exposed ReAct channels, including chain-of-thought, tool calls, tool
observations, and an elicited summary. It also places the secret in exactly one
of three origins—model weights, the prompt, or the retrieval store—and computes
a source-specific K-Score that credits forgetting only when the deployed agent
remains usable.

The abstract reports a sharp certificate mismatch. In structured retrieval, the
secret remains verbatim in tool observations even after the answer channel is
cleared, leaving aggregate leakage unchanged. For prompt- or retrieval-store
secrets, TOFU and MUSE report no leakage while the deployed agent leaks the
secret on **22–86% of queries**. For weight-resident secrets, none of twenty
published methods demonstrably removes the secret under the evaluated setup;
only an input-corruption intervention reaches selective forgetting under the
evaluated observer. The highest-ranked method also changes across base models,
and resistance to extraction through refusal tuning is not treated as verified
knowledge removal.

This adds a deployment-wide evaluation contract for forgetting claims:

1. **Name the secret origin**—weights, prompt, retrieval, or another stateful
   substrate—rather than attributing every leak to model memory.
2. **Inspect every observable channel**, not only the terminal response.
3. **Pair non-disclosure with usability**, so universal refusal does not earn a
   forgetting certificate.
4. **Separate extraction resistance from removal**; silence under one observer
   is not proof that the information is absent.
5. **Report per-model results**, because the abstract finds that method rankings
   are not stable across base models.

The broader implication is that unlearning is a system property once a model is
embedded in an agent. A model-level certificate cannot cover secrets copied into
prompts, retrieval stores, or tool outputs, and an answer-level evaluator cannot
see those transfers. This extends §38's answer/trace split from computational
validity to information governance: a compliant final answer can coexist with a
leaking execution trace.

**Boundary:** Scout reviewed the v1 metadata and complete abstract returned by
the arXiv API, not the full paper or benchmark implementation. The abstract does
not enumerate all six channels or provide per-method experimental detail, so the
reusable result here is the evaluation decomposition and reported aggregate
mismatch—not an independent validation of K-Bench or a ranking of unlearning
methods.

Source: https://arxiv.org/abs/2609.12808v1  
Source: https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

---

## §43 Sparse Domain Labels Need Estimation and Validation, Not Raw Slice Means (2026-09-20)

**Prediction-Powered Smoothing and Validation for Disaggregated AI Evaluation**
([2609.20758v1](https://arxiv.org/abs/2609.20758v1)) treats an evaluation set as
a finite population and asks for point and interval estimates of performance in
each domain—for example, task types in a benchmark or conversation types in
deployed-agent traffic. The practical problem is that exhaustive human grading
is expensive: direct estimates, including prediction-powered inference (PPI),
use only a domain's own labels and become imprecise for sparsely labeled slices.

The authors propose prediction-powered smoothing (PP-S), a Bayesian model fit to
each domain's prediction-powered estimate, plus PP-TS, which can borrow strength
across a reporting taxonomy. They pair estimation with an approximately unbiased,
design-based cross-validation score for choosing between direct and smoothed
estimators. On one curated benchmark with verifiable grading and one deployed
agent-traffic dataset graded by humans—both with every outcome available for
retrospective comparison—the abstract reports better point and interval estimation
than direct estimators, with near-nominal interval coverage. At the same labeling
budget, the proposed score reportedly selects estimators as well as an independent
validation sample and estimates the selected estimator's error more accurately.

This adds an **estimation layer** to agent evaluation. Reporting every slice is not
enough when some slices have very few labels: noisy raw means can make small domains
look exceptionally good or bad, while a single aggregate can hide them entirely.
A useful evaluation report should therefore retain the domain taxonomy and sampling
design, publish sample counts and uncertainty intervals, compare direct and pooled
estimates, and validate the estimator-selection rule rather than choosing smoothing
because it produces tidier results. Borrowing strength should follow a declared
reporting structure, not silently erase meaningful domain differences.

**Boundary:** Scout reviewed the live arXiv API metadata and complete abstract, not
the full paper, equations, datasets, code, or subgroup tables. The improvement and
coverage statements are author-reported for two fully observed retrospective study
populations. The abstract does not quantify gains by domain, specify how sensitive
PP-TS is to a misspecified taxonomy, or establish performance when the human labels
or model predictions are systematically biased. Smoothing narrows sampling
uncertainty; it does not repair a bad grader, missing domain, or invalid taxonomy.

Source: https://arxiv.org/abs/2609.20758v1  
Source: https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

---

## Related Notes

- [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md#36-the-diagnostic-architecture-crisis--evaluation-as-infrastructure-hnarxiv-june-2026) ← exact preceding coverage (§23–§36)
- [Agent Evaluation Patterns](./agent-evaluation.md) ← parent canonical note (§1–§11)
- [Agent Evaluation Research Patterns](./agent-evaluation-research.md) ← first companion (§12–§22)
- [Agent Architectures](./agent-architectures.md) — evaluation infrastructure and agent-system composition
