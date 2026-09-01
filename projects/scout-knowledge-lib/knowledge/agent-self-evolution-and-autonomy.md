<ai_context>
summary: "Agent self-evolution is best modeled as a governed release loop over explicit mutable surfaces, not as a single capability. Evidence across human-collected XHS seeds, papers, and pinned code shows credible gains for externally gated memory, skill, prompt, harness, model, and environment updates, while streaming transfer and vague-goal autonomy remain unreliable."
triggers: ["agent self-evolution", "self-improving agents", "recursive self-improvement", "agent autonomy", "harness evolution", "self-harness", "AgentStream", "Aspire", "gated evolution"]
last_updated: "2026-09-01"
source_basis: "The 2026-09-01 130-card human-collection checkpoint and retained Scout notes; full HTML or metadata review of cited primary papers; pinned Harness-Bench and AgentStream code inspection; and the standing Scout SkillRise inspection. Reported results remain attributed unless a Scout reproduction is explicitly named."
</ai_context>

# Agent Self-Evolution and Autonomy: A Governed-Release View

## Executive conclusion

"Self-evolving agent" is an overloaded label. It can describe a model that
retries once, a frozen model that accumulates a skill, an external optimizer
that rewrites a harness, a training loop that updates weights, or a system that
chooses what it should learn. These systems have different mechanisms, risks,
and evidence requirements.

The most useful operational definition is:

> **Self-evolution is a durable, system-induced change to an explicit agent
> configuration, admitted because independent evidence predicts a net benefit
> outside the experience that proposed the change.**

This definition excludes ordinary within-task correction unless it persists,
and excludes an edit loop from being called improvement merely because it ran
successfully. It also separates **adaptation** from **autonomy**. A system may
adapt its memory or harness under a human-specified benchmark without choosing
its goal, evaluator, authority, or deployment scope.

Current evidence supports bounded, externally gated evolution more strongly
than recursive autonomy. Self-Harness reports held-out gains from a fixed model
proposing harness edits, but an external evaluation system retains admission
authority. AgentStream reports that transfer changes with model, method, and
stream composition. Aspire moves closer to autonomy by hiding the concrete
task behind a broad goal; agents routinely complete update loops, but retained
above-base gains are rare and successor harnesses remain below an engineered
reference. The practical frontier is therefore a **release system for learned
changes**, not permission for a runtime to rewrite itself without an
independent acceptance boundary.

## A taxonomy that names what changed

An agent configuration can be written as:

```text
C = (M, P, X, K, T, W, E, J, A)
```

where `M` is model weights, `P` prompts and policies, `X` working context, `K`
durable memory or skills, `T` tools, `W` workflow/harness code, `E` environment
or curriculum, `J` evaluators and objectives, and `A` authority and deployment
scope. A claim of self-evolution should identify the changed coordinate and the
coordinates held fixed.

| Form | Durable update | Typical signal | Credible evidence | Primary risk |
|---|---|---|---|---|
| Within-task correction | none, or only `X` | critique, tool error | paired retry on the same task | mistaking search for learning |
| Experience memory | `K` facts or episodes | outcome, reflection | fresh-session pathway probe | stale or poisoned recall |
| Skill/procedure learning | `K` executable or textual skills | later-task outcome | held-out transfer and knockout audit | coalition pollution, hidden curriculum |
| Prompt/context evolution | `P`, sometimes retrieved `K` | judge score or task reward | protected cases across domains and orders | prompt bloat, cross-domain interference |
| Harness evolution | `W`, `T`, `P`, routing, recovery | traces plus executable validators | isolated candidate, regression gate, lineage | evaluator overfit, unsafe policy drift |
| Model evolution | `M` through SFT/RL/distillation | reward or verifier | held-out retained gain plus broad regression | catastrophic regression, proxy hacking |
| Environment co-evolution | `E` task generation or shaping | policy weaknesses | fresh rollouts with original verifier | curriculum leakage, collapsing difficulty |
| Objective/evaluator evolution | `J` | broad goal or self-constructed proxy | sealed goal-aligned evaluation | evaluator capture and goal drift |
| Recursive co-evolution | several of `M,W,E,J,A` | prior-round evidence | repeated, versioned rounds with independent stop/admission | loss of causal identity and control |

Two additional axes prevent category errors:

- **Proposal authority:** human, external optimizer, target model, or a mixed
  committee.
- **Admission authority:** the proposer itself, an independent model, an
  executable verifier, protected held-out outcomes, or a human owner.

A target model proposing an edit is "self" in the narrow generative sense. If
an external controller supplies tasks, budgets, protected cases, rollback, and
promotion, the overall system is still governed adaptation rather than broad
autonomy.

## An autonomy ladder

| Level | System discretion | What is still fixed externally | Evidence state |
|---|---|---|---|
| A0 — fixed executor | chooses actions within one task | goal, configuration, evaluator | routinely deployed |
| A1 — episodic repair | retries or reflects within a task | update target and acceptance | useful but not durable evolution |
| A2 — retained adaptation | writes memory or skills across tasks | objective, update interface, deployment scope | credible in bounded domains |
| A3 — gated self-modification | proposes prompt/harness/model candidates | mutation budget, protected tests, admission and rollback | promising controlled evidence |
| A4 — goal operationalization | chooses data, update method, and proxy for a broad goal | sealed goal evaluator and authority envelope | Aspire finds sparse, unstable gains |
| A5 — recursive autonomy | co-evolves model, harness, environment, and learning policy | only constitutional/owner boundary | research program, not validated capability |

The transition from A3 to A4 is the important autonomy boundary. Below it, the
system searches **how** to optimize a specified objective. At A4 it also chooses
**what operational objective** stands for a broad human goal. That increases
the decision space and creates a new failure: a locally excellent proxy may be
irrelevant to the intended capability.

## Highest-value evidence clusters

### 1. Harness evolution works when it looks like software release engineering

**Paper reports.** Harness-Bench (`2605.27922v1`) holds tasks, sandboxes,
budgets, timeouts, and evaluators constant while varying model–harness
configurations. Across 5,194 trajectories on 106 tasks, configurable harness
aggregate scores span 52.4 to 76.2. The paper correctly treats these as
configuration-level descriptions, not causal ablations of individual harness
mechanisms.

Self-Harness (`2606.09498v3`) freezes model weights and evaluators. The same
base model mines clustered failures and proposes minimal harness edits; an
evaluation system tests candidate branches on held-in and held-out splits.
Across nine model–benchmark pairs, the paper reports improvements on both
splits. Held-out Terminal-Bench-2.0 pass rates move from 40.5% to 61.9% for
MiniMax M2.5, 23.8% to 38.1% for Qwen3.5-35B-A3B, and 42.9% to 57.1% for
GLM-5. The mechanism is credible because the proposer never sees held-out
traces and rejected candidates do not alter the active harness.

HarnessOpt-Bench (`2608.06301v1`) strengthens the evaluation contract: separate
development, validation, and inaccessible test partitions; isolated execution;
versioned candidates; and case-exposure budgets. Its 111 reported runs show
visible validation bests are generally optimistic and that the median optimizer
uses 82% of its case allowance despite only 4% of its call allowance. The
scarce resource is fresh evidence, not merely API calls.

HarnessCompass (`2608.01918v1`) reports that task-agnostic constraints,
proactive first-person feedback, and component-wise optimization improve
SWE-bench Verified Pass@1 from 54% to 66% with GPT-5.4 in five iterations. This
supports constrained, typed mutation, but remains one paper's reported result.

**Scout observed.** The paper-linked Harness-Bench repository at
[`1025086`](https://github.com/Qihoo360/harness-bench/commit/1025086a446653702b80cfb48babbeec35db6b2c)
loads 106 task definitions with matching IDs, declared prompts, and oracle
modules. A no-credential demo run of `001-file` completed in 0.506 seconds and
its programmatic oracle scored 1.0. The repository has no GitHub Actions
workflow. Its only earlier commit has 28 task YAML files, while the pinned June
revision expands to 106; the repository is implementation provenance for the
current suite, not an exact reproduction of the paper's 5,194 model calls.

**Analysis.** The phrase "the agent improves its own harness" hides the most
important safety fact: a target model proposes, but a fixed external gate
promotes. The demonstrated architecture is closer to branch, test, review, and
release than to a running process overwriting its own control plane.

### 2. Streaming transfer is the missing validity test

**Paper reports.** AgentStream (`2608.00155v1`) crosses five experience methods
(ACE, a context-integrated harness method, ReasoningBank, AutoSkill, and A-Mem)
with three frontier models and isolated, sequential, and interleaved streams.
The paper reports that a weak model cannot reliably convert experience into
gain; benefit is non-monotonic in model strength; and the best method changes
with model and scenario. On GPT-5.4 only one of five methods beats vanilla on
average and the worst loses 2.3 points. ACE's reported gain falls from +2.28%
in isolated streams to -1.26% when domains are interleaved, while retrieval
methods benefit from selective exposure in mixed streams.

The library's task-order review of `2608.18066v1` supplies a separate warning.
In that study, a +1.5% default-order ReasoningBank gain becomes -4.5% under
shuffled orders, and memory raises run-to-run variance in 17 of 24 comparisons.
SkillRise (`2607.26784v1`) reports strong cross-task gains, but the standing
Scout audit confirms its bundled groups use fixed within-group positions and
environment-provided families. The prepared order perturbations are evidence
infrastructure, not outcome reproduction.

**Scout observed.** The paper-linked AgentStream code at
[`3b2e028`](https://github.com/microsoft/Sico/commit/3b2e0281faa89fd3c183b82b38ed009f25a13de6)
contains separate runners for the five named methods. Each uses one task-order
function and exposes the same three modes. The ordering code fixes task
selection at seed 42, varies within-benchmark order by experiment seed, and
interleaves benchmarks while preserving within-benchmark order. A
standard-library-only extraction of those exact helper functions confirmed
determinism, seed-sensitive interleaving, preservation of each benchmark's
relative order, and one-time inclusion of all synthetic tasks. Running the
repository's own self-test was blocked before test logic by missing local
`pydantic`; no dependency install or model experiment was needed for the
source-level claim.

**Analysis.** "Improves over time" is not a scalar property. It is conditional
on the base model, update representation, domain mixture, order, retrieval
policy, and early stochastic outcomes. A credible evaluation needs complete
sequential repetitions and permutations, not independently sampled tasks
followed by a learning narrative.

### 3. Broad-goal autonomy is much less reliable than bounded adaptation

**Paper reports.** Aspire (`2608.31111v1`) hides task-level evaluators behind
six broad capability goals and allows agents to choose data, update methods,
training plans, self-evaluations, and candidate branches. Its sealed evaluation
contains 520 expert-authored items.

The gap between executing an update and improving is large:

- All 24 final-only runs complete an evaluation, but only 3 final checkpoints
  beat their base score; only 1 of 12 two-run model–goal means is positive.
- In 30 adaptive-feedback cells, 28 produce an evaluated checkpoint and 21 an
  eligible checkpoint, yet only one eligible above-base checkpoint survives
  rollback. That retained result used repeated feedback on the same fixed
  slice, so it is selection evidence rather than independent replication.
- Across 62 consecutive checkpoint transitions, 28 rise, but a rising lineage
  can remain far below base. One mathematics run rises 0.79 → 1.75 → 2.38 while
  its base is 17.86.
- Five checkpoints trained on 21,000 single-digit targets emit single digits
  for all 279 evaluation answers and score 0, 0, 0, 6.141, and 0. This is an
  observed association with format collapse, not a randomized causal result.
- Three valid successor harnesses all score below the engineered Qwen-Agent
  reference. The closest is 27.22 task-macro versus 28.64; another optimizes an
  eight-item self-check from 7/8 to 8/8 but scores only 19.32 on the hidden set.

**Analysis.** Aspire tests a more meaningful autonomy threshold than papers
whose benchmark and reward are supplied. It shows that current systems are
better at completing the mechanics of training or editing than at choosing a
proxy that preserves intended capability. This is **improvement theatre** at a
technical level: the loop is busy and artifacts exist, yet protected utility
does not rise.

The safe inference is not that autonomous learning is impossible. It is that
goal operationalization, evaluator construction, and terminal candidate
selection are distinct competencies. Authority over any one should not imply
authority over the others.

### 4. Weight, harness, and environment co-evolution is promising but causally fragile

AgentEvolver (`2511.10395v1`) combines self-questioning task generation,
self-navigation through experience reuse, and self-attribution of rewards.
MetaEvolve (`2607.21971v1`) trains a model to refine programs from execution
fitness and reports 10.01 absolute points over its strongest in-distribution
baseline, 24.12 out of distribution, and a 46.9% relative improvement on
open-ended algorithm optimization. EnvHarness (`2608.19880v1`) wraps rather
than rewrites static environments and reports up to a 9.0-point held-out gain
with 9.8% fewer steps. HELIX (`2608.13951v1`) preserves typed harness
interventions and sibling trajectories, reporting a 4.0% fixed-harness coverage
gain and up to 58.0% extra portfolio coverage in one code-repair round.

These papers identify useful mechanisms, but their gains are not additive and
do not establish an indefinite recursive loop. Once `M`, `W`, and `E` all
change, attribution requires factorial or staged controls, repeated seeds, and
frozen anchors. Otherwise the system cannot tell whether a model improved, a
curriculum became easier, a harness specialized, or an evaluator drifted.

## Failure modes and controls

| Failure mode | Observable symptom | Why it happens | Minimum control |
|---|---|---|---|
| Improvement theatre | update completes, protected score does not rise | process completion used as outcome | above-baseline terminal gate |
| Self-judge capture | eloquent reflection and high self-score, weak external result | proposer and judge share blind spots | independent executable or sealed evaluator |
| Validation overfit | visible best exceeds nominated test result | repeated exposure selects noise | inaccessible final set and case-exposure ledger |
| Hidden curriculum | gains disappear under shuffle or reverse order | sequence leaks difficulty or relatedness | order permutations and repeated full streams |
| Cross-domain pollution | isolated gain becomes mixed-stream loss | context-integrated rules apply too broadly | scoped retrieval, domain tags, interleaved test |
| Coalition pollution | bank improves while a new skill is harmful | incumbent skills carry the candidate | paired knockout / marginal contribution audit |
| Regression recovery | later checkpoint rises but remains below base | first update caused a large loss | compare every lineage point to immutable base |
| Interface mismatch | method looks safe or weak because artifacts cannot execute | learned representation and runtime disagree | compatibility test before capability scoring |
| Security reachability drift | conditional attack rate falls while total harm rises | stronger agent reaches hostile surfaces more often | measure exposure, compromise, and effects separately |
| Model–method mismatch | method ranking changes by model | weaker models cannot extract signal; strong models saturate | per-model selection, no universal default |
| Harness bloat | cost and prompt mass grow without utility | every local lesson becomes a permanent rule | typed budget, pruning, cost-aware admission |
| Objective drift | proxy improves while intended capability falls | agent operationalizes a broad goal narrowly | sealed goal-aligned evaluator and human veto |
| Causal identity loss | no one can explain which mutation caused a gain | components merge or co-evolve together | one typed change per candidate, factorial follow-up |
| Irreversible bad update | regression propagates into future learning state | candidate writes directly to champion | immutable lineage, quarantine, atomic promotion, rollback |

## A practical gated-evolution workflow

```text
real task evidence
  -> typed failure hypothesis
  -> one isolated candidate mutation
  -> mechanism/compatibility checks
  -> development evaluation
  -> protected multi-order, multi-domain regression
  -> security and cost deltas
  -> independent admission decision
  -> scoped canary
  -> champion promotion or rollback
  -> retained lineage and revisit trigger
```

### Required artifacts

1. **Immutable champion manifest:** hashes model, prompts, tools, harness,
   memory/skill bank, environment, evaluator, and authority policy.
2. **Experience record:** captures task, outcome, trace, environment revision,
   principal, and uncertainty without treating model reflection as fact.
3. **Typed proposal:** names exactly one primary mutable surface, causal
   hypothesis, scope, expected benefit, risk, and rollback plan.
4. **Candidate branch:** cannot alter the champion, evaluator, held-out labels,
   or deployment permissions.
5. **Evidence ledger:** separates search spend, case exposure, candidate runtime
   cost, and protected acceptance evidence.
6. **Admission receipt:** records baseline and candidate revisions, metrics,
   confidence/resolution, judge identity, decision, and rejected alternatives.
7. **Scoped release:** canary population, expiry, health predicates, and atomic
   rollback. A successful canary expands scope; it does not erase lineage.

### Admission matrix

Do not compress improvement into one score before reviewing its coordinates.

| Dimension | Example criterion |
|---|---|
| Capability | candidate beats champion outside acquisition cases |
| Retention | no decision-relevant regression on frozen anchors |
| Mechanism | intended save/retrieve/execute or harness path is observed |
| Transfer | gain survives repeated seeds, task orders, and relevant domains |
| Safety | exposure, conditional compromise, and unauthorized effects do not worsen beyond policy |
| Integrity | outputs, tools, and workspace state agree; final artifact is valid |
| Cost | deployment cost fits budget; search cost is separately recorded |
| Authority | proposal and deployment stay within explicit owner scope |
| Recoverability | champion can be restored and learned state can be quarantined |

Small samples should produce **unresolved**, not automatic acceptance. The gate
may admit Pareto improvements, reject dominated candidates, or request another
experiment. It should not manufacture precision by averaging capability and
safety into one opaque number.

## When each approach is useful

- Use **within-task repair** when errors are cheap, state is disposable, and a
  verifier exists. Do not call it learning.
- Use **memory or skills** when task families recur and retrieval can be scoped.
  Prefer later-task outcomes to prose self-ratings.
- Use **harness evolution** when failures are traceable to tools, context,
  routing, recovery, or output contracts. Keep weights and evaluator fixed
  during candidate attribution.
- Use **weight evolution** when there is enough independent, representative
  reward and broad regression coverage to justify its higher rollback cost.
- Use **environment evolution** to target policy weaknesses only if the
  original verifier and frozen anchor environments remain available.
- Use **broad-goal autonomy experiments** in sealed sandboxes with strict
  budgets and owner-controlled promotion. Current evidence does not support
  autonomous production admission.

## Research directions, prioritized

1. **Replicate the boundary, not the headline.** Compare target-model proposals
   with external-optimizer proposals under the same protected gate. This tests
   whether "self" contributes beyond search cost and model fit.
2. **Run streaming factorials.** Cross model × method × domain order × seed,
   preserve every intermediate learned artifact, and analyze transfer and
   variance rather than only final means.
3. **Qualify evaluators before evolution.** Measure false acceptance under
   adversarial proposals, then keep evaluator revision independent from the
   candidates it judges.
4. **Test vague-goal decomposition.** Separate goal interpretation, proxy
   construction, data choice, update execution, and terminal selection so a
   failed campaign can be localized.
5. **Measure learning-state security.** Track who can write, retrieve, revise,
   approve, activate, and forget every memory, skill, or harness mutation.
6. **Study subtraction.** Give pruning candidates equal status with additions;
   measure prompt mass, tool surface, latency, and retained utility.
7. **Build co-evolution causal ledgers.** For `M/W/E` loops, preserve frozen
   anchors and sibling candidates so later gains can be attributed rather than
   narrated.

## Evidence boundaries

- XHS collection titles are human-interest and selection evidence, not paper
  validation. Except for the separately documented SkillRise detail, this
  synthesis does not claim post bodies were read.
- arXiv results above are author-reported unless explicitly labeled as a Scout
  observation. No large model training or benchmark campaign was reproduced.
- The two local checks validate repository structure, deterministic ordering,
  and a demo oracle path. They do not reproduce paper accuracy numbers.
- The standing Scout loop already deep-dived SkillRise, memory-stage risk, and
  coalition-aware skill admission. This note reuses those results and focuses
  its new work on the taxonomy, harness/streaming comparison, and autonomy
  boundary.

## Primary sources and maintained context

- Human seed provenance: [XHS seed ledger](./xhs-seed-ledger.md) and
  [living topic map](./xhs-topic-map.md)
- Prior Scout synthesis: [self-improving agent loops](./findings/2026-07-23-hn-self-improving-agent-loops.md),
  [harness optimization evaluation](./findings/2026-08-08-arxiv-harness-optimization-evaluation.md),
  [skill admission](./findings/2026-08-08-skill-admission-before-activation.md),
  and [memory evolution admission](./findings/2026-08-26-memory-evolution-heldout-admission.md)
- Taxonomy survey: [arXiv:2607.13104v1](https://arxiv.org/abs/2607.13104v1)
- Harness measurement and evolution:
  [2605.27922v1](https://arxiv.org/abs/2605.27922v1),
  [2606.09498v3](https://arxiv.org/abs/2606.09498v3),
  [2608.06301v1](https://arxiv.org/abs/2608.06301v1), and
  [2608.01918v1](https://arxiv.org/abs/2608.01918v1)
- Experience and stream validity:
  [2608.00155v1](https://arxiv.org/abs/2608.00155v1),
  [2608.18066v1](https://arxiv.org/abs/2608.18066v1),
  [2607.26784v1](https://arxiv.org/abs/2607.26784v1), and
  [2608.22610v1](https://arxiv.org/abs/2608.22610v1)
- Model/environment/co-evolution:
  [2511.10395v1](https://arxiv.org/abs/2511.10395v1),
  [2607.21971v1](https://arxiv.org/abs/2607.21971v1),
  [2608.19880v1](https://arxiv.org/abs/2608.19880v1), and
  [2608.13951v1](https://arxiv.org/abs/2608.13951v1)
- Autonomy and safety boundaries:
  [2608.31111v1](https://arxiv.org/abs/2608.31111v1) and
  [2608.17684v1](https://arxiv.org/abs/2608.17684v1)

The companion [evidence report](../reports/research/agent-self-evolution-autonomy-deep-dive-2026-09-01.md)
contains the seed inventory, value rubric, source/claim map, exact local checks,
and integration notes.
