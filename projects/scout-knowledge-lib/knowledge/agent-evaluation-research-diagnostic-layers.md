<ai_context>
summary: "Third companion note to agent-evaluation.md containing the cohesive §37–§46 diagnostic-layers block from August–September 2026. Separates candidate supply from answer selection, answer correctness from trace integrity, implementation readiness from blocker localization, AI-AI coordination from human convention recovery, detected trace patterns from causal attribution, answer-level forgetting from deployment-wide secret leakage, aggregate scores from uncertainty-aware domain estimates under sparse labels, end-to-end voice quality from the language model's decisions inside a cascade, model capability from deployment-specific scale decisions, and causal debugging of one recorded decision from general agent reliability."
triggers: ["agent evaluation diagnostic layers", "candidate supply", "answer selection", "judge reliability", "selection loss", "fixed candidate pools", "trace integrity", "CAIT Rate", "execution contract", "answer-trace consistency", "structured-data agent", "IdeaAMBIG", "codification readiness", "specification gap", "defect localization", "clarification action", "convention gap", "implicit communication", "human-AI compatibility", "Hanabi", "Off-Belief Learning", "partner legibility", "failstep", "failure diagnosis", "causal attribution", "deterministic detectors", "trace normalization", "K-Bench", "agentic unlearning", "K-Score", "deployment-wide leakage", "tool-observation leakage", "disaggregated evaluation", "prediction-powered smoothing", "small area estimation", "domain mean", "interval coverage", "reporting taxonomy", "voice agent evaluation", "cascaded voice agent", "MTVA-Bench", "tool argument accuracy", "action ordering", "EnterpriseVal", "deployment evaluation", "frozen configuration", "consequence tier", "reviewer catch rate", "scale gate", "runtape", "counterfactual debugging", "recorded decision", "context ablation", "agent regression test"]
last_updated: "2026-09-30"
source_basis: "Extracted intact from agent-evaluation-research-beyond-outputs.md §37–§40 on 2026-09-11 after the block grew into a reusable August–September companion. §37 derives from arXiv 2608.25937; §38 from the arXiv API and full HTML for 2608.26036; §39 from the arXiv API and full HTML for 2609.10539; §40 from the arXiv API and full HTML for 2609.11489. §41 adds static GitHub inspection of AbdelazizBs/failstep pinned at 09166c7cc356bd1f7c96b1bd54b34d82d7c2d581; repository code was not executed. §42 derives from the arXiv API abstract for K-Bench (2609.12808v1). §43 derives from the live arXiv API abstract for prediction-powered smoothing and validation (2609.20758v1). §44 derives from the live arXiv API abstract for MTVA-Bench (2609.20152v1). §45 derives from the live arXiv API abstract for EnterpriseVal (2609.21841v1). §46 derives from static inspection of RehanMohammed985/runtape at e75717124a07d9f5c848b4e34861ba0e980d588f, including README, implementation, tests, benchmark description, saved summaries, and HN item 49904620; Scout did not execute the package or rerun model experiments."
parent_note: "agent-evaluation.md"
previous_companion: "agent-evaluation-research-beyond-outputs.md"
</ai_context>

# Agent Evaluation Research: Diagnostic Layers (August–September 2026)

**Third companion to [Agent Evaluation Patterns](./agent-evaluation.md)** — this note
continues [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md#36-the-diagnostic-architecture-crisis--evaluation-as-infrastructure-hnarxiv-june-2026),
which covers §23–§36 and establishes why evaluation must inspect the substrate rather
than only terminal outputs.

This note covers §37–§46: ten diagnostic layers that localize where apparently
successful agent behavior can fail — candidate selection, computational trace,
specification readiness, partner-legible convention recovery, the boundary
between detected trace patterns and causal attribution, secret leakage outside
the final-answer channel, domain-level uncertainty hidden by aggregate scores,
language-model decisions hidden inside an end-to-end voice pipeline, the
translation from model capability to a deployment-specific scale decision, and
the causal context of one recorded decision.

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

## §44 Evaluate the Decision-Making Layer Inside a Voice-Agent Cascade (2026-09-20)

**MTVA-Bench** ([2609.20152v1](https://arxiv.org/abs/2609.20152v1)) targets the
language model inside a cascaded voice agent rather than scoring either the whole
ASR–LLM–TTS pipeline or an ordinary text-only model call. Its scenarios preserve
conditions the decision model actually encounters: transcription errors, caller
speech split across messages, language and script requirements, multi-turn state,
and backend tool responses determined by the arguments the model sent.

The benchmark contains 49 agents across 490 reviewed scenarios and seven
languages. An LLM plays the caller from a rubric, while a mock backend executes
the model's proposed arguments. Scoring combines deterministic tool-call checks
with two LLM judges: one applies scenario-specific rules and one grades
conversation quality without seeing the task; both must cite transcript messages.
Task and conversation scores receive equal weight. In the abstract's seven-model
study, six models selected the correct tool within a 6.4-point band, yet overall
scores spanned 24.4 points. The larger differences came from argument values,
action ordering, rule compliance, and the language surrounding tool calls.

This adds a **cascade-layer isolation rule** to agent evaluation. End-to-end audio
quality can conceal whether a failure came from recognition, decision-making, or
speech generation, while a clean text benchmark removes the noisy and segmented
input the decision model must handle. Evaluate the interfaces separately and
retain at least: transcription presented to the model, turn boundaries, selected
tool, exact arguments, ordering, backend response, rule compliance, and user-facing
conversation quality. Correct tool selection is only one intermediate event, not
a task-completion verdict.

**Boundary:** Scout reviewed the live arXiv API metadata and complete abstract,
not the paper, scenario set, prompts, transcripts, code, language breakdowns, or
judge calibration. The caller is model-simulated and the backend is mocked, so
the reported results do not establish robustness to real callers, ASR systems,
latency, interruptions, telephony, or production tools. The abstract does not
report uncertainty, per-language results, or whether the 24.4-point spread is
stable across judge choices.

Source: https://arxiv.org/abs/2609.20152v1  
Source: https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

---

## §45 A Deployment Gate Must Bind the Workflow, Configuration, and Consequence (2026-09-21)

**EnterpriseVal** ([2609.21841v1](https://arxiv.org/abs/2609.21841v1)) argues that
public capability benchmarks answer a different question from an enterprise
scale decision. Its proposed evaluation unit is a specified use case plus a
frozen socio-technical configuration: model, prompts, retrieval, tools,
guardrails, and human oversight. Autonomy level and consequence tier determine
the required evaluation intensity, while the metric set spans fidelity,
utility, efficiency, reliability, assurance, and oversight.

The abstract describes a two-tier algorithm that maps metric vectors with
confidence bounds to `REJECT`, `CONDITIONAL`, or `SCALE`, and a value-and-risk
model that treats reviewer catch rate as a measured parameter rather than an
assumed benefit. That yields a useful deployment-evaluation boundary:

1. **Bind evidence to the deployable configuration.** A model score cannot stand
   in for the exact prompt, retrieval, tool, guardrail, and review system that
   will operate the workflow.
2. **Match evidence burden to authority and consequence.** More autonomous or
   consequential uses should require stronger assurance, reliability, and
   oversight evidence instead of sharing one generic launch threshold.
3. **Retain uncertainty in the decision.** Confidence bounds and a conditional
   state prevent a point estimate near a threshold from becoming a false binary
   launch verdict.
4. **Measure the reviewer channel.** Human review changes expected value only to
   the extent that reviewers catch relevant failures under the tested workload;
   nominal human presence is not a reliability parameter.
5. **Separate performance, value, and scale authority.** Fidelity or utility can
   pass while cost, risk, or oversight evidence still blocks scale. A gate should
   preserve the failed dimension rather than compressing all evidence into one
   score.

The abstract reports a pilot across three workflows at a global bank. For
credit-memo drafting, it reports 88% human-graded citation precision and a 1.6%
hallucination rate for the best model, against stated gates of 70% and 5%. For
procedure transformation, it reports estimated analyst refinement effort falling
from 27.4 to 2.9 hours per document. These examples support evaluating a concrete
workflow rather than a model in isolation, but they do not validate the complete
gating framework.

**Boundary:** Scout reviewed the complete live arXiv API abstract, not the full
paper, formal specification, algorithm, pilot protocol, data, grader calibration,
confidence intervals, or value model. The authors explicitly distinguish
established results, documented pilot evidence, the proposed system, and open
hypotheses. The reported bank figures are author claims and include an estimated
baseline for refinement effort; the abstract does not show that the thresholds
were preregistered, that reviewer catch rate was measured in the cited pilots, or
that `SCALE` decisions improved production outcomes. Treat EnterpriseVal as a
useful deployment-evaluation design, not a validated universal gate.

Source: https://arxiv.org/abs/2609.21841v1
Source: https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

---

## §46 Debug One Recorded Decision by Intervening on Its Context (HN/GitHub, 2026-09-30)

**Runtape** records model calls and tool events, then reruns one selected model
call while removing or replacing parts of its recorded context. Its useful
contribution is a bridge between observability and regression testing: a trace
shows what the agent saw, while repeated input interventions test whether a
specific message, tool result, paragraph, sentence, or JSON item changed the
probability of the selected decision. The implementation screens context pieces,
confirms candidates with a one-sided Fisher exact test corrected for the number
of tested removals, narrows confirmed pieces, searches a bounded set of
interactions, and rechecks a headline cause with different replacement text.
Only the selected model call is replayed; the agent's tools and external effects
are not executed again.

The paired `fix` path tries a small declared set of changes against the exact
failure context—for example an untrusted-content rule, an action guard, both, or
removing the identified source—and labels a candidate as passing only when the
bad action disappears from its reruns and the reduction is significant. It can
then emit a pytest regression that replays that decision distribution. This
suggests a practical incident workflow:

1. preserve the exact trace, model/provider identity, target event, and bad-action
   predicate;
2. establish that the failure remains reproducible before attributing it;
3. intervene on context pieces and correct significance for the search family;
4. test candidate fixes against the same recorded decision without replaying
   real-world side effects; and
5. retain the trace and predicate as a model-backed regression, while separately
   testing the full agent and effect path.

The repository's author-run benchmark plants one harmful instruction in tool
output across five synthetic domains. It keeps a case only when that model takes
the harmful action in at least 5 of 10 runs with the sentence and at most 1 of
10 without it. In the published summaries, 14 counted cases still reproduced
when attribution ran; all 14 named the planted sentence as the headline cause,
and 12 narrowed it exactly. Ten other counted cases had become unstable and
were reported separately rather than treated as successful attributions. That
honesty is as important as the headline rate: counterfactual diagnosis needs a
stable decision and provider, not merely a saved bad sample.

**Boundary:** “cause” here means that intervening on text in this model call and
context changed the measured decision distribution. It is not an explanation of
model internals, proof of the root cause across models or contexts, or evidence
that the proposed fix makes the end-to-end agent safe. The benchmark is
synthetic, selectively includes cases with a known single planted cause, does
not cover distributed causes or long causal chains, and includes rescoring after
the cases informed implementation fixes; the author calls for a new-seed run.
Scout inspected the repository at the pinned commit but did not execute its 62
`why`/`fix` tests, rerun the saved traces, or independently reproduce model calls.
The project was two days old, marked alpha, and had no GitHub stars or forks at
inspection, so it is promising diagnostic evidence rather than a mature tool.

Source: https://news.ycombinator.com/item?id=49904620

Repo: https://github.com/RehanMohammed985/runtape

Pinned observation: https://github.com/RehanMohammed985/runtape/commit/e75717124a07d9f5c848b4e34861ba0e980d588f

---

## Related Notes

- [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md#36-the-diagnostic-architecture-crisis--evaluation-as-infrastructure-hnarxiv-june-2026) ← exact preceding coverage (§23–§36)
- [Agent Evaluation Patterns](./agent-evaluation.md) ← parent canonical note (§1–§11)
- [Agent Evaluation Research Patterns](./agent-evaluation-research.md) ← first companion (§12–§22)
- [Agent Architectures](./agent-architectures.md) — evaluation infrastructure and agent-system composition
