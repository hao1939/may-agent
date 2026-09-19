<ai_context>
summary: "Agent self-evolution is not one mechanism. The credible core is a governed release loop over explicit mutable surfaces: skills, memory, routing, harness code, weights, world models, or evaluators. Current evidence is strongest when an external fixed evaluator controls admission, and much weaker for self-generated or co-evolving judges and broad-goal autonomy."
triggers: ["agent self-evolution", "self-improving agents", "recursive self-improvement", "agent autonomy", "skill evolution", "harness evolution", "world models", "co-evolving evaluators"]
last_updated: "2026-09-19"
source_basis: "A source-agnostic 984-row lead ledger: 908 observed cards from the human's Xiaohongshu collection, including a bounded authenticated frontier of 11 readable text bodies and one image-only cover; 69 primary paper, repository, benchmark, survey, blog, and interview records; and 8 existing Scout artifacts, plus 2026-09-10 direct XHS inspection of HarnessEvolve reception, an HN-surfaced primary-paper inspection of Procedural Graphs (arXiv 2609.09153), 2026-09-11 inspection of HN-surfaced Salesforce Beagle at commit 15f12b7, 2026-09-11 full-paper inspection of Ecdysis (arXiv 2609.11677v1), 2026-09-12 direct XHS inspection of the Seed/TokenWave Self-Developing Agents announcement, 2026-09-13 direct XHS inspection of Procedural Graphs reception, 2026-09-14 direct XHS inspection of a six-survey self-evolution reading map and its practitioner discussion, 2026-09-15 inspection of the HN-surfaced rekursiv.ai auto-autoresearch report plus its runnable NanoChat recipe at Priml commit 92c6bd2, 2026-09-16 inspection of EvoOntology's ontology-evolution lifecycle and admission boundary at commit ace8ff69, 2026-09-19 abstract-level inspection of SoL-Pi (arXiv 2609.20519v1), and 2026-09-19 inspection of SourceShift/mini-ork's path-specific self-modification controls at commit 962bf478. Claims are traced to full primary sources and pinned code where available; titles remain discovery metadata, never technical evidence."
</ai_context>

# Agent Self-Evolution and Autonomy: What Actually Changes?

## Executive conclusion

“Self-evolving agent” currently names several different things:

- searching for a better answer, program, or population while the agent itself stays fixed;
- writing reusable memory or skills;
- learning which skill, tool, or model to select;
- rewriting harness code;
- updating model or world-model weights;
- changing the procedure that proposes future changes; or
- changing the evaluator that decides what “better” means.

These are not interchangeable. The most useful operational definition is:

> **Agent self-evolution is a durable, system-induced change to an explicit
> agent configuration, admitted because evidence predicts a net benefit beyond
> the experience that proposed the change.**

This definition excludes an ordinary retry, a longer search, and an optimizer
that evolves task solutions without changing the deployed agent. It also does
not imply autonomy. A system can update skills or weights while humans still
fix its goal, evaluator, budget, authority, and release boundary.

The strongest current evidence supports **bounded evolution under an external,
fixed acceptance gate**. A regression test on previously observed tasks is
useful but is not a generalization gate; promotion also needs protected cases
that did not generate the proposal. Evidence becomes less trustworthy as the
proposer and judge share assumptions, as validation cases are reused, or as the
evaluator itself changes. Broad-goal autonomy remains especially weak: Aspire
agents often completed training or harness-editing loops, but rarely produced a
checkpoint that beat the immutable base under sealed evaluation.

## Describe an evolution claim in six coordinates

An agent configuration can be written as:

```text
C = (M, P, X, K, T, W, E, J, A)
```

`M` is model weights, `P` prompts and policies, `X` working context, `K`
durable memory and skills, `T` tools, `W` workflow or harness code, `E`
environment or curriculum, `J` objective and evaluator, and `A` authority and
deployment scope.

Every claim should answer six questions:

1. **Object:** which coordinate changed?
2. **Persistence:** does the change survive a fresh task or session?
3. **Proposer:** who generated it—the target model, another model, search, or a human?
4. **Admission:** who can reject or promote it?
5. **Evidence:** were fresh, protected cases used, with repeats and regressions?
6. **Authority:** where can the promoted change act, and how is it rolled back?

This exposes common category errors. EvoX and CORAL evolve candidate solutions
and search strategies under a fixed task evaluator; AgentFlow changes planner
state within a rollout; AdaJEPA adapts a predictive world model; Agent-as-a-
Router learns deployment routing. All are useful, but none alone proves a
general agent can safely rewrite itself.

## Taxonomy by mutable object

| Form | Durable object | Learning signal | What would establish value | Main failure |
|---|---|---|---|---|
| Within-task repair | only `X` | error or critique | paired retry on the same task | search mislabeled as learning |
| Experience memory | `K` episodes/facts | outcome and reflection | fresh-session retrieval and knockout | stale or poisoned recall |
| Skill creation | new `K` procedures | traces, lessons, synthesis | held-out marginal gain | fluent but false procedure |
| Skill curation/admission | activation state or routing over `K` | verifier outcomes | paired candidate/knockout gate | coalition credit and early overconfidence |
| Skill maintenance | typed metadata and library structure | consistency/static checks | repair without downstream regression | clean metadata, unchanged behavior |
| Skill internalization | `M` trained with privileged skills | RL or distillation | skill-free inference on held-out tasks | privileged-context leakage |
| Adaptive routing | selector state over models/tools/skills | cost and verified outcomes | low cumulative regret under drift | lock-in to early or biased evidence |
| Prompt/harness evolution | `P`, `T`, `W` | traces plus executable scores | isolated candidates and protected tests | evaluator overfit and harness bloat |
| Policy evolution | `M` | reward, critique, verifier | retained held-out gains and broad regressions | proxy hacking and forgetting |
| World-model evolution | predictive part of `M` | observation prediction error | better prediction and downstream planning | prediction improves without policy value |
| Environment/curriculum evolution | `E` | policy weaknesses | original fixed benchmark remains better | curriculum becomes easier |
| Evaluator evolution | `J` | meta-judgment or downstream reward | independent anchor catches judge drift | policy–judge collusion |
| Meta-procedure evolution | proposer/search code in `W` | future candidate quality | transfer of improvement ability | fixed benchmark mistaken for open-endedness |

## Implementation signal: autonomy is a property of a mutation path, not a repository

**Observed 2026-09-19. Repo:** [SourceShift/mini-ork](https://github.com/SourceShift/mini-ork) at commit [`962bf47874b84ca0a393851d59896cdbb71a6eaa`](https://github.com/SourceShift/mini-ork/tree/962bf47874b84ca0a393851d59896cdbb71a6eaa).

mini-ork contains at least two materially different self-change paths. Its
[`self_improve.py`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/mini_ork/cli/self_improve.py)
outer loop creates a fresh branch and worktree for each patch, requires three
deterministic verifier results plus an explicit approving model-critic verdict,
commits only after those gates pass, and merges into the current branch only
when `--auto-merge` is supplied. The default therefore creates a reviewable
branch without activating it on the parent branch.

The separate [`apply.py`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/mini_ork/cli/apply.py)
path mutates recipe prompt files. File writes are master-gated off by default,
but once enabled there is deliberately no human approval branch: a real
held-out probe must strictly improve the measured candidate, previously passing
per-task probes may not regress, fabricated scorers cannot authorize promotion,
and an unmeasured or dead two-arm probe is quarantined. A promoted mutation is
then written directly, with prior bytes retained for rollback. The repository's
[`SAFETY.md`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/docs/SAFETY.md)
is unusually explicit that its seven-rung ladder describes intent rather than a
runtime dispatcher, that the advertised declarative `config/safety.yaml` root
of trust does not exist, and that the effective backstop for this unattended
path is the measurement gate plus version control.

This is useful evidence for a sharper audit rule: **never label a system
“human-gated,” “autonomous,” or “rollback-safe” at repository level.** Inventory
each mutation path as `(target, enable switch, evaluator, activation action,
recovery action)`. Here, harness-code evolution and prompt evolution share a
project but not the same activation boundary. The former defaults to branch
quarantine; the latter defaults disabled, then becomes measurement-authorized
and immediately effectful when enabled. A policy diagram that merges those
paths would overstate human review on one side or understate isolation on the
other.

Limits: this inspection established control flow and documentation at one pinned
commit; it did not run the probe suite, exercise rollback, or independently test
that all mutation entry points pass through these gates. The model-based patch
critic is also not an independent deterministic evaluator, even though its
missing or non-approving verdict fails closed.

## Six comparisons that matter in practice

### 1. Creation, admission, maintenance, and internalization are separate jobs

| Stage | Representative work | Strength | Weakness | Prefer when |
|---|---|---|---|---|
| Create | Memento-Skills, Trace2Skill, MetaClaw, WikiSkill | turns experience into reusable procedures and structured knowledge | generation quality, attribution, and persistent-layer contamination are uncertain | failures repeat and artifacts can be inspected |
| Curate/admit | SkillOpt, SkillBoost, SkillOS, Bayesian-Agent, PL-HCL | controls edits or activation using held-out scores, regressions, outcomes, or contracts | gates differ sharply in independence; RL curation is costly | the library is large or evidence is sparse |
| Maintain | SkillOps, later Memento repository | detects duplication, contract drift, and stale structure | measured behavioral gains are modest | library entropy is the bottleneck |
| Internalize | OPID, SEED, SkillRL | removes retrieval cost at inference | training is expensive and errors become parametric | behavior is stable, well verified, and frequently reused |

Creation is not proof of usefulness. Admission is not maintenance. Maintenance
does not show that a skill transfers. Internalization makes rollback harder and
therefore needs a stricter gate than external retrieval.

Trace2Skill adds an important warning: skill value is combinatorial. A patch can
help the trace that produced it and regress unrelated tasks when combined with
other patches. Its artifact-aware diagnosis is better grounded than a single
log-only model call, but its default application of all consolidated patches
lacks a per-patch behavioral gate. Bayesian-Agent addresses the opposite
problem—too little evidence—by accumulating a posterior before patching,
compressing, or retiring a procedure. Its strongest completion improvements
also use substantially more tokens, so uncertainty control is not free.

Existing Scout work on Recuris and CASS supplies the missing release boundary:
test the candidate's mechanism, compare paired held-out outcomes with and
without the candidate in the incumbent bank, cap regressions, and promote a
content-addressed champion. The inspected skill-evolver implementation adds
transactional staging, backups, and rollback, although its isolated suite had
2 failures among 879 tests and provides no comparative capability campaign.

SkillOpt is stronger than immediate skill append: it bounds document edits,
keeps rejected edits, selects against held-out tasks, and reports the test set
only at the end. The later SkillOpt-Sleep preview is a separate deployment
package, not evidence from the paper. SkillBoost adds typed failure attribution
and accepts a repair only when `Fix−Regress>0` and `Regress<epsilon`; its gate
ablations and cross-agent/cross-benchmark transfer are useful, but admission
back-tests the full observed set rather than an inaccessible promotion set.
No SkillBoost implementation was available to verify that invariant.

WikiSkill retains raw experience, a structured wiki, and derived skills. That
separation helps the proposer—Gemini's reported average rises 48.7→63.7 with
wiki access—but giving the wiki directly to the executor lowers it to 60.9.
Only skills roll back after rejection; the wiki persists. Small validation sets
are reused for up to eight iterations, and Qwen-4B spreadsheet skills reduce
Gemini from 50.5→18.1 in one transfer. A persistent knowledge layer therefore
needs its own transactional gate, provenance, and rollback, not only a gate on
the final skill file.

### 2. Harness-only, weight-only, and joint evolution solve different problems

| Strategy | Examples | Advantage | Disadvantage |
|---|---|---|---|
| Harness-only | Self-Harness, Meta-Harness | cheap rollback, inspectable diffs, no retraining | cannot create model-internal capability; may accumulate complexity |
| Weight-only | RLTF, AgentFlow, ECHO | inference-time behavior can improve without growing context | expensive, harder to attribute and reverse |
| Joint | RetroAgent, SkillRL, Co-Harness | external structure supplies better training signal; weights reduce runtime dependence | factorial attribution, debt, and regression become harder |

Meta-Harness shows that raw execution traces and selectively accessed full
history can matter more than compressed summaries: its full interface reached
50.0 median search accuracy versus 34.6 for scores only and 34.9 for scores plus
summaries. That supports evidence access, not unlimited context stuffing—the
proposer uses filesystem search to select relevant history.

Co-Harness alternates failure-attributed harness repair and supervised
fine-tuning. It reports average math accuracy rising from 58.5 to 73.5 to 78.9
over two rounds across two Qwen scales and three benchmarks. This is promising
joint optimization, but not yet recursive general improvement: the study is
math-focused, contains two full rounds, needs a capable critic and substantial
training compute, and leaves structural harness redesign to humans.

RHO shows that label-free retrospective proposal can help on resettable past
trajectories, with separate optimization and held-out benchmark splits. It does
not establish a reliable self-admission rule: on SWE-Bench Pro, self-preference
selected 0.78 while its three candidates averaged 0.79. Its “single-round”
Meta-Harness comparison uses 103 calls versus 41, while the 320-call ten-round
baseline reaches 0.80, so the result is round-matched rather than compute-
matched. A later protocol critique of AHE-style evolution—not a replication of
RHO—finds matched `K=5` parallel or sequential task search often wins and
disjoint-task transfer averages only +0.6 points. Candidate generation and
promotion reliability must therefore be measured separately.

EvoHarness-RL is likewise not an equal-budget “8B matches Opus” result. Its
Qwen3-8B agent uses 87 successful Opus trajectories, Opus consolidation each
epoch, 150 GRPO epochs, and eight H200 GPUs. On seen ALFWorld, Opus with the
same BPE harness scores 98.5 versus Qwen's 96.9; no Opus unseen comparison is
reported. The supported claim is domain-specific teacher-assisted harness and
weight coordination, not small-model parity.

### 3. Fixed, generated, and co-evolving evaluators have different evidential weight

| Evaluator | Examples | Evidence quality | Appropriate use |
|---|---|---|---|
| Fixed and isolated | Self-Harness, EvoX, CORAL, HyperAgents | strongest, if held-out and not repeatedly exposed | admission and causal comparison |
| Generated but anchored | SkillCoach, EvoRubric | useful for dense process feedback; correlated blind spots remain | proposal, triage, auxiliary reward |
| Co-evolving without a fixed anchor | mostly proposed future work | presently weak | research only, never sole promotion authority |

EvoRubric is a serious generated-evaluator result, not proof of evaluator
independence. A policy generates dynamic rubrics while an external meta-verifier
filters them, and GPT-4.1 is still used as a meta-judge in analysis. The method
may discover more discriminative criteria, but policy and rubric can share
blind spots. Cross-model review, as in ARIS, adds diversity but also does not
create independence: models may share training data, prompts, and benchmark
assumptions.

The new admission evidence sharpens a three-way distinction: back-testing the
observed set catches incumbent regressions; a frozen validation set chooses
among proposals; and an inaccessible promotion/test set estimates transfer.
One set cannot safely serve all three roles through repeated rounds.

### 4. Centralized and decentralized sharing exchange speed for contamination risk

| Topology | Examples | Benefit | Risk | Required control |
|---|---|---|---|---|
| Central curator | SkillOS, ARIS | consistent schema and admission | bottleneck and curator bias | versioned proposals, protected gate |
| Shared writable memory | CORAL | fast discovery diffusion | one agent's false lesson spreads quickly | provenance, quarantine, marginal tests |
| Isolated populations | EvoX, HyperAgents | diversity and rollback through archives | duplicated work and expensive evaluation | shared evaluator, lineage, budget accounting |

CORAL's evaluator and worktree isolation are strong. Its shared notes and
skills, however, are directly writable; evaluator isolation protects scores,
not the truth of shared knowledge. Shared memory accelerates both learning and
pollution.

### 5. Task-level and per-step routing address different credit problems

Agent-as-a-Router chooses a model for a whole coding task. Giving a vanilla
router held-out per-dimension performance statistics improves its score from
41.41 to 47.74, supporting the paper's “information deficit” diagnosis. Its
deployment memory and cumulative regret are valuable routing ideas, but the
agent models remain fixed.

OPID addresses local credit assignment inside long trajectories. It extracts
episode-level workflow skills and critical-step skills, routes critical ones to
selected decisions, and uses the old policy's probability shift under
skill-augmented context as a token-level training advantage. Skills disappear
at inference. This is more precise than applying one outcome to every token,
but the paper's reviewed results do not provide the repeated-run uncertainty
needed to know how stable the gains are.

### 6. World prediction and policy evolution must be measured separately

ECHO trains the policy to predict terminal observation tokens already present
in its rollouts while retaining the ordinary policy-gradient objective. It
requires no extra rollout or teacher and reports TerminalBench-2 pass@1 gains
from 2.70% to 5.17% for Qwen3-8B and 5.17% to 10.79% for Qwen3-14B. The relative
gain is large; the absolute success rate is still low.

AdaJEPA instead updates a latent predictive model during plan–act–adapt–replan
control. Better prediction can improve model-predictive planning under visual
or dynamics shift without changing the policy. The distinction is causal:

```text
world-model update -> prediction error -> replanning -> behavior
policy update      -> action distribution directly
```

The broad “agent-centric world proxy” survey usefully separates dynamics,
spatial, execution, memory, skill, and verification proxies across inference,
training, and co-evolution. Its breadth is also a risk: if every useful feedback
source is called a world model, the term stops distinguishing prediction from
memory, tools, and evaluators.

### XHS reception frames harness evolution as a release pipeline

A current [XHS HarnessEvolve post body](https://www.xiaohongshu.com/search_result/6a9ed8d3000000000d024c20),
not merely its search card, translates the method into an engineering sequence:
compare a failed trajectory with a reference trajectory, locate the first
meaningful divergence, edit the implicated harness layer, reject answer leakage,
and run regressions before admission. The author likens the two gates to agent
CI/CD and attributes an ablation drop from 86.9 to 57.8 to removing the reference
trajectory. Scout did not inspect the paper in this source-specific run, so the
number and method remain the post author's account rather than independent
verification.

The reception itself adds one useful operational question. A commenter asks how
the correct reference trajectory is obtained and how much reference coverage is
needed. That is not a rebuttal, but it identifies the method's deployment hinge:
first-divergence credit is only as available and representative as its reference
trajectories. The practical fallback suggested by another commenter—retain
replayable intermediate states—supports diagnosis when a gold trajectory is
missing, but does not supply the same counterfactual supervision. This reinforces
the existing separation between **diagnosis evidence** and **promotion evidence**:
a plausible divergence can nominate a patch; protected regressions and fresh
cases must still decide whether to ship it.

### XHS now packages self-development as a multi-surface research program

A later [XHS announcement body](https://www.xiaohongshu.com/explore/6aa15407000000002602237e)
says ByteDance Seed and TokenWave launched a “Self-Developing Agents” project
that groups Aspire, S³Gym, HarnessDev, and related papers, experiments, and code.
Its most useful signal is organizational rather than technical: the post defines
self-development as discovering problems, extracting experience, and then
changing prompts, memory, tools, or workflows. That list spans several mutable
coordinates in this note's taxonomy instead of presenting “self-improvement” as
a single method.

This announcement does **not** report comparative results, an admission gate,
or evidence that the grouped methods improve one deployed agent. It therefore
supports a narrower conclusion: self-development is becoming an umbrella
research program organized around explicit mutable surfaces. Each included
system still needs to disclose what changes, what persists, who evaluates the
change, and which protected evidence permits promotion.

### XHS survey reception converges on the mutable-layer question

A current [XHS reading map](https://www.xiaohongshu.com/search_result/6a623f3d000000001d020a02)
organizes six self-evolving-agent surveys through several competing cuts: what,
when, and how a system changes; which component is optimized; whether evolution
is model-centred, environment-centred, or joint; and whether prompts, memory,
tools, control logic, or weights form the mutable scaffold. The post also
attributes four possible forms of retained experience to one survey—skills,
persistent memory, verifiable environmental feedback, and trainable model
behaviour—and highlights “meta-evolution” of the improvement procedure itself.
Scout did not inspect those six papers in this XHS-only pass, so these are the
post author's descriptions rather than verified summaries of the surveys.

The useful signal is convergence, not another taxonomy. The post's component
question—**what exactly is being optimized?**—maps directly to this note's
mutable-object coordinate. Its comments then expose the next unresolved layer:
readers ask which layer should change after a failure, whether a small error can
cause an overreaction analogous to an unstable training update, and whether
memory evolution has demonstrated deployment cases. That practitioner response
supports a stricter reporting rule: name both the mutable surface and the
credit-assignment/admission mechanism. “Self-evolving” is otherwise too broad
to distinguish a controlled release from an agent merely rewriting its own
state. Engagement (198 likes and 323 saves when read) shows interest in a
consolidated reading map, not evidence that any method works.

### Procedural Graphs make the mutable procedure explicit—but graph syntax is not the gate

[Procedural Graphs](https://arxiv.org/abs/2609.09153), surfaced in
[HN item 49629868](https://news.ycombinator.com/item?id=49629868), represents
procedural memory as typed procedure-to-procedure edges. At each step a guidance
model localizes the current node and verbalizes its two-hop neighborhood; an
offline refiner then proposes topology or attribute edits from successful and
failed traces. Structural checks and a separate validation split decide whether
the candidate replaces the retained graph, while rejected edits remain negative
memory. This is a concrete external, inspectable, and reversible mutation surface
rather than an implicit lesson buried in an ever-growing transcript.

The broad comparison is meaningful: with a shared ReAct solver and training
traces, the graph ranks first or joint first in 21 of 24 model–benchmark settings
against no memory, summarized or retrieved experience, textual insights,
conditional guidelines, linear workflows, and textual transition rules. The
largest reported margin over the strongest baseline is 9 points; HotpotQA ranges
from -0.9 to +1.3 points, so the advantage is not uniform. A same-graph ablation
is more diagnostic: local two-hop guidance beats raw or generated full-graph
injection on three benchmarks and uses 14.8–70.9% fewer tokens than full-graph
generation, although it still costs 33.4% and 55.4% more tokens than no graph on
GDPval and ALFWorld.

Its evolution trace illustrates why rejection receipts matter. In the CFO
simulator, validation rejected three performance regressions, one structurally
invalid candidate, and a final mutation whose training survival reached 90% but
validation fell to 85%. The returned checkpoint achieved 85% test survival
against 0% for the unguided baseline. Yet each validation decision used only 20
episodes and could turn on one or two outcomes; the paper explicitly frames
those decisions as search traces rather than significance tests. Repeated
non-decrease tests on a reusable validation set are therefore useful rollback,
not inaccessible promotion evidence.

HN discussion identifies the remaining attribution question: is the graph the
essential representation, or an editable durable task list with named references?
The study controls many memory baselines and shows that *localized* graph use is
better than full-graph use, but does not isolate graph syntax against an equally
editable hierarchical task list or simple self-modifying skill/harness. The
durable operational lesson is narrower: externalize procedures into a typed
artifact, localize what the solver sees, preserve rejected mutations, and keep a
separate final test. Do not infer that every procedure needs a graph.

A later [XHS explanation body](https://www.xiaohongshu.com/explore/6aa4bb3e0000000026015bc3)
shows how that result is being translated for practitioners. Its useful metaphor
is “GPS rather than rails”: locate the current node, expose a local neighborhood,
and let the solver choose rather than forcing a fixed SOP. The post also correctly
surfaces the paper's Gemini 3.5 Flash result in the CFO simulator: guidance reduced
redundant tool use from 18.94 to 12.53 calls per simulated month while improving
the enterprise score. That is not a universal efficiency result—the paper reports
that calls increased for Claude Sonnet 4.6 and Gemini 3.1 Pro—nor does the post
independently replicate the paper. Its broader “0% to 85%” headline is the returned
CFO test checkpoint after a validation-selected evolution trace, not an aggregate
across tasks or models. The reception is evidence that localized procedural
guidance and its efficiency story are legible to builders, while reinforcing a
reporting rule: retain the benchmark, model, split, denominator, and unit when
turning an experiment into an operational claim.

## What the strongest evidence says

### Bounded skill learning works, but transfer is conditional

- **RetroAgent** changes both weights and explicit memory. With Qwen-2.5-7B it
  reports GRPO-to-RetroAgent gains of 77.3→95.6 on ALFWorld, 66.9→82.3 on
  WebShop, 11.2→38.3 on Sokoban, and 39.3→48.2 on MineSweeper, averaged over
  three runs. Half-group memory augmentation beats full-group augmentation,
  showing that extra guidance can suppress exploration.
- **Memento-Skills** reports GAIA test 52.3→66.0 and an HLE subset 17.9→38.7,
  but uses one underlying Gemini model and notes weak GAIA cross-task reuse:
  most learned skills never fire on test.
- **SkillOS** reports ALFWorld 47.9 without memory, 55.7 with ReasoningBank, and
  61.2 with its learned curator. Some cross-task transfers are negative, and
  curator–executor compatibility matters more than curator size.
- **SkillOps** reports 79.5% versus 70.6% for its strongest standalone baseline,
  but drop-in gains are only 0–2.9 points and much of the large-library test is
  synthetic, high-level PDDL maintenance in one domain.
- **SkillCoach** shows why outcome-only admission is unsafe: a successful final
  answer can hide wrong skill selection and ad-hoc repair. Semantically similar
  distractors degrade routing before a library visibly collapses.

### Search strategy can evolve without the deployed agent evolving

EvoX co-evolves candidate artifacts and the search policy that chooses parents,
variation operators, and inspirations. CORAL lets long-lived agents decide
when to retrieve, propose, evaluate, and update shared knowledge. Both retain a
fixed hidden evaluator. They are best understood as adaptive search portfolios.

HyperAgents goes further: the task agent and the meta-agent that modifies it
are one editable program. It reports held-out paper-review improvement from
0.0 to 0.710 and robotics reward-design improvement from 0.060 to 0.372 over
100-iteration searches, with confidence intervals and ablations. This is a
genuinely broader mutation surface than EvoX or a fixed meta-agent. It still
uses fixed domains, evaluation, archives, budgets, and human safety controls;
its own limitations state that the implementation does not establish
unbounded progress.

### Beagle makes harness evolution operational—but its defaults are plumbing, not proof

An HN submission surfaced Salesforce AI Research's open-source
[Beagle](https://github.com/SalesforceAIResearch/Beagle), which turns the DarwinX
harness-evolution procedure into a resumable campaign system. It treats harness source
as the mutable artifact, evaluates candidates through each benchmark's native runner,
keeps a genealogy database and isolated worktrees, distinguishes kept, archived,
rejected, failed, and no-change nodes, and can preserve regressing specialists for later
recombination without presenting them as the shipped best node. Its typed configuration
also fails on unknown knobs rather than silently accepting configuration drift.

The more important signal is the boundary Beagle's own documentation draws around those
features. The generated smoke runs one node and one sample, and exercises only the built-in
canary, content, and anti-cheat path. Cross-benchmark protection, mixture gates, repeated
mini-evaluation, fixed comparison panels, scope constraints, and the optional verifier are
separate opt-ins. Several settings have narrower behavior than their names suggest: the
current mixture score is a regression floor rather than the parent-selection objective,
`subset_eval_n_attempts` is not consumed by the hosted pipeline, and only one parent-solved
canary is probed per node by default. Thresholds for regression and cross-benchmark gates
must be calibrated from baseline rerun variance; copied margins are not evidence.

This implementation sharpens the practical rule: **the presence of an evolution gate is
not an evaluation claim**. A credible campaign record must name which gates actually ran,
their sample counts and calibrated margins, the fixed or held-out task identities, the
selection metric, and a final untouched-data evaluation of the selected commit. A dry-run
or one-node smoke proves wiring, not generalized improvement.

*Sources: [HN item 49650988](https://news.ycombinator.com/item?id=49650988);
[Beagle repository](https://github.com/SalesforceAIResearch/Beagle);
[pinned README](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/README.md),
[DarwinX configuration guide](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/docs/darwinx-configuration.md),
[typed configuration](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/beagle/algorithms/darwinx/config.py), and
[algorithm adapter](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/beagle/algorithms/darwinx/algorithm.py),
commit [`15f12b7`](https://github.com/SalesforceAIResearch/Beagle/commit/15f12b7b014740583dda14454f0ba2227dd6de92), inspected 2026-09-11. The published benchmark table and generalization claims are author-reported and were not independently reproduced here.*

### Recurrent failures are stronger patch evidence than isolated failures—not promotion evidence

[Ecdysis](https://arxiv.org/abs/2609.11677v1) changes the unit of harness
repair from one failed trajectory to failure patterns recurring across a batch.
Its multi-role FDCR stage separates diagnosis from implementation: analyst,
critic, and engineer roles refine a structured modification specification; a
coding agent changes the harness. This is a useful causal discipline because a
single failure can reflect an idiosyncrasy of the task model rather than a
systematic defect in prompts, state handling, or tool coordination. Editing the
harness around every such error can shrink the valid action space into a
model-specific workaround.

The comparison controls the initial harness, frozen model weights, training
evaluation, rollback, early stopping, and at most three candidate rounds.
Candidates are evaluated on a subsequent complete training pass rather than on
the trajectories that generated them, retained only on strict improvement, and
then frozen before held-out testing. On the five-model by two-subset
`τ²-Bench` matrix, average accuracy rises from 46.67% for per-failure
self-evolution to 54.67% with batch aggregation and 59.33% with aggregation plus
FDCR. Across `τ²-Airline`, `τ²-Retail`, and AgentBench, the paper reports
58.67%→69.56% average accuracy (an 18.56% relative gain) over the same baseline.
The harness was evolved with Qwen3-8B and reused without further evolution for
four other task models, so the cross-model result is more informative than a
same-model training replay.

The efficiency result also separates two mechanisms. Aggregation without FDCR
is cheapest and fastest: versus the self-evolution baseline, reported API cost
falls from $8.484 to $2.485 on Retail and $6.382 to $2.136 on Airline, with
1.42× and 3.23× speedups. FDCR recovers more accuracy but spends some of that
advantage; its corresponding speedups are 1.30× and 1.84×. Collaborative
critique is therefore an accuracy-oriented option, not the source of the main
training-efficiency gain.

The boundary matters: recurrence is **proposal evidence**, not causal proof or
release authority. Correlated tasks can repeat the same spurious pattern, and
the paper's promotion rule reuses 20 training tasks per `τ²` subset. The held-out
20-task subsets and three trials provide useful transfer evidence, but this is a
small, domain-limited campaign with author-reported results and no inspected
implementation artifact. A production loop should cluster failures by mechanism,
prefer changes supported across independent tasks and models, then still require
fresh protected cases, regressions, lineage, and rollback.

*Sources: [arXiv abstract](https://arxiv.org/abs/2609.11677v1),
[full HTML](https://arxiv.org/html/2609.11677v1), and
[API metadata](https://export.arxiv.org/api/query?id_list=2609.11677), inspected
2026-09-11. Quantitative results are reported by the paper and were not
independently reproduced here.*

### Realistic evaluation often matters more than another mutation operator

AgentGym2 contains 437 tasks—182 complex tool-use, 57 data-analysis, and 198
deep-search tasks—with 652 attachments. Hidden information, tool discovery,
ambiguity, noise, and distractors all lower performance. Three runs per task
and reported 98.9% human/LLM-judge agreement make it a useful deployment
validity check, though it is not a self-evolution method.

AgentStream is the best direct warning against universal memory defaults. It
crosses five experience methods, three frontier models, and isolated,
sequential, and interleaved streams. The winning method changes by model and
stream; a method can help in isolation and hurt when domains interleave. A
separate task-order study turns a reported +1.5% default-order ReasoningBank
gain into −4.5% under shuffled orders.

SEAGym turns evaluation into an explicit lifecycle: train exposure, frozen
update-validation, held-out in- and out-of-distribution tests, replay,
snapshots, and cost. Its AHE run reports validation 40.0→57.1 but held-out ID
only 40.0→49.1 and OOD 22.5→28.8; one intermediate epoch collapses to 6/80
replay tasks before recovery, and batch sizes 10 and 80 regress while 20 works
best. This makes forgetting and optimization-path sensitivity visible. The
released deterministic engine is operational—the goal-owned checkout passed
161 tests with 7 skipped—but provider-backed results remain author-reported.

The matched-budget harness critique adds a harder baseline. On Terminal-Bench
2.1 without unit-test feedback, direct execution averages 68.2, parallel search
72.3, sequential refinement 69.3, and harness evolution 67.4; with feedback,
parallel reaches 86.0 and sequential 84.3 versus harness evolution 75.8. On a
disjoint 45/10/34 split, evolved-harness transfer averages only +0.6. These are
protocol-level results for AHE-style evolution, not a direct refutation of
RHO, but they justify requiring a harness-sensitivity diagnosis, matched task-
level search, and disjoint transfer before crediting harness evolution itself.

### Inherited task progress is not evidence that the research process improved

Rekursiv.ai's HN-surfaced NanoChat campaign makes this distinction unusually
concrete. Its agent teams preserved failed experiments, handed tested code and
matched-seed panels to later waves, and sometimes revised role prompts and
submission procedures. The current Priml recipe exposes a cumulative runnable
sequence and reports a final B200 score of 0.887791 mean BPB over ten seeds.
That is inspectable evidence of a better *training recipe*, not by itself a
causal evaluation of the evolving research harness.

The authors report that, in one retrieval-policy cohort, availability of the
inherited recipe explained 97.79–100% of control-relative improvement area.
They also disclose only two runs per model in one early-branch comparison,
different provider stacks, human interventions, and a service interruption
that left 35 completed panels awaiting qualification across 48 launched
campaigns. Those details expose three separate ledgers:

1. **task-state progress:** which code, configuration, failure, or measured
   result descendants inherited;
2. **process mutation:** which prompt, role, routing, deadline, or recovery rule
   changed; and
3. **process efficacy:** a matched comparison showing that the process change,
   rather than inherited task state or extra opportunity, improved future
   discovery.

A swarm can be valuable while only the first ledger is strong. Preserve
completion and qualification as different events, compare process variants
from the same starting packet under matched resources, and report inherited-
recipe contribution separately from incremental discovery. Otherwise
"self-improving research" collapses artifact accumulation and causal
meta-improvement into one label.

Source: https://news.ycombinator.com/item?id=49716123  
Primary report: https://rekursiv.ai/blog/autoautoresearch/  
Repo: https://github.com/rekursiv-ai/priml  
Inspected revision: https://github.com/rekursiv-ai/priml/commit/92c6bd2b23e922ecde5548431cd644c4cb6debe5  
Runnable recipe and result table: https://github.com/rekursiv-ai/priml/blob/92c6bd2b23e922ecde5548431cd644c4cb6debe5/priml/baselines/nanochat/README.md#reproducing-the-blog-post

### Harness evolution can optimize efficiency without proving general self-improvement

*SoL-Pi: Recursively Scaling Auto-Research Loops for Efficient Agent Harness*
([2609.20519v1](https://arxiv.org/abs/2609.20519v1)) treats the harness as the
mutable surface. The authors report scaling auto-research rollouts across more
numerous and diverse environments, then retaining four mechanisms spanning
action execution, context compaction, observation handling, and delegated
reading. On the 51-task EdgeBench evaluation, the abstract reports performance
comparable to Pi across GPT-5.6 Sol and Opus 5 while reducing recorded token
traffic by 44.7–49.0% and API cost by about one third. It translates those cost
changes into estimated hourly savings of $8.75–$13.50 versus native Codex and
Claude Code harnesses, and $4.36–$5.71 versus Pi.

This is a useful reminder that an evolution loop can target a multi-dimensional
release objective rather than benchmark accuracy alone: maintain verified task
performance while reducing tokens and cost. It also reinforces the distinction
between **search output** and **process improvement**. Four mechanisms surviving
selection is evidence that one search produced a compact candidate harness; it
does not by itself show that the recursive search procedure became better, that
each mechanism caused part of the gain, or that the candidate generalizes
outside EdgeBench. A defensible release receipt should therefore bind the
parent and candidate harnesses, model and task panel, performance-equivalence
margin, token-accounting boundary, prices, and held-out results. Dollar savings
should remain derived, price-sensitive estimates rather than the primary
measurement.

**Evidence boundary:** Scout reviewed the live arXiv API abstract, not the full
paper, harness implementation, rollout histories, EdgeBench task definitions,
or cost records. The mechanism count, model names, performance comparison,
token reduction, and savings are author-reported abstract claims. The abstract
does not state the equivalence margin, uncertainty, train/test separation, or
per-mechanism ablations needed to attribute transfer or causal value.

### A documented promotion gate is not an enforced promotion gate

[EvoOntology](https://github.com/ruc-datalab/EvoOntology) is a concrete,
inspectable ontology-evolution layer for data agents. It versions semantic
records, records tool-call trajectories rather than chain of thought, freezes a
round budget, keeps rejected candidates in the same run, and advances the
checkpoint only when a candidate is published. Its workflow distinguishes a
protected validation reserve in fixed-split benchmarks from a frozen batch plus
separately sampled validation tasks in rolling deployments. The authors report
ontology-versus-baseline gains of 8.8 points on BIRD, 20.0 on DDR-Bench, and 1.0
on InsightBench across a four-backbone subset; these are repository/paper
claims, not independently reproduced results.

The implementation exposes an important control-plane boundary. The skill tells
the model to fix the evaluator, call the ground-truth or anonymous A/B gate,
reject regressions, and accept only a reproducible improvement. The Python gate
itself is simple and inspectable: a candidate wins when its mean ground-truth
score strictly exceeds the parent's, or when it wins more judged cases with no
candidate critical error. But `EvolutionSession.accept()` checks only that a
candidate exists and loads, then publishes it, switches the active version, and
advances the checkpoint. The public `accept_evolution` operation calls that
method directly; it does not require a recorded evaluation, a passing gate
receipt, paired case identities, or an acceptance-policy digest. Tests likewise
exercise publication after merely recording candidate metrics.

This is not evidence that the intended workflow routinely bypasses evaluation.
It is evidence that lifecycle integrity and admission integrity are separate.
A robust self-evolution control plane should make promotion consume a typed,
immutable gate receipt bound to the parent, candidate, evaluator revision,
protected case set, acceptance policy, and result. Human- or model-readable
instructions remain valuable, but they should not be the only barrier between a
candidate artifact and active state.

**Repo:** https://github.com/ruc-datalab/EvoOntology

**Inspected revision:** https://github.com/ruc-datalab/EvoOntology/commit/ace8ff695f6b1752240cb0e0322f65667d7016eb

**Primary evidence:** [architecture and split contract](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/docs/architecture.md), [evaluation gate](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/evaluation/evaluation.py), [accept/publish state transition](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/evolution/session.py), [operation boundary](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/runtime/ops.py), [workflow instructions](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/plugins/claude-code/skills/evo-evolve/SKILL.md), and [lifecycle operation test](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/tests/test_mcp_ops.py).

### RL can expand capability only under identifiable headroom

The controlled synthetic study *On the Interplay of Pre-Training,
Mid-Training, and RL* reconciles two slogans. RL expands pass@128 when
pretraining leaves missing but reachable combinations and tasks sit near the
model's competence edge; it does little when primitives are absent or the task
is already saturated. Under fixed compute, targeted mid-training often beats
RL-only. This is evidence for conditional capability expansion, not that RL
always creates new abilities or merely sharpens existing ones. The released
training stack and checkpoints make the study inspectable, but its synthetic
math tasks do not establish the same causal boundary in open environments.

### Formal limits are warnings, not turnkey gates

The Two-Gate result in *On The Statistical Limits of Self-Improving Agents*
requires fixed-distribution IID data, bounded loss, independent validation,
one changing axis at a time, and a fixed ex-ante reachable hypothesis envelope.
Promotion must exceed `2εV+τ`, not merely improve a validation score. The paper
formalizes why repeated adaptive reuse consumes evidence, but practical
capacity bounds for modern agent harnesses remain unknown. Use it to motivate
protected data and bounded mutation surfaces, not to claim a deployable VC-
dimension gate.

## Novelty and value rubric

Use four independent scores rather than rewarding a new name:

- **Mechanism novelty:** does it change a new object or causal pathway?
- **Decision value:** would it change architecture, evaluation, or deployment?
- **Evidence strength:** are controls, protected tests, repeats, uncertainty, and code available?
- **Operational readiness:** are isolation, admission, lineage, and rollback implemented?

| Cluster | Mechanism | Decision value | Evidence | Readiness | Judgment |
|---|---:|---:|---:|---:|---|
| protected harness evolution | 3/4 | 4/4 | 3/4 | 4/4 | deployable pattern with bounded evidence |
| skill creation + gated admission | 3/4 | 4/4 | 3/4 | 3/4 | useful now; gate independence and coalition transfer still vary |
| persistent wiki + derived skills | 3/4 | 4/4 | 2/4 | 1/4 | proposer value, but unrolled-back knowledge can contaminate descendants |
| per-step skill internalization | 3/4 | 3/4 | 2/4 | 2/4 | promising training method, expensive to reverse |
| adaptive search portfolios | 3/4 | 3/4 | 3/4 | 3/4 | useful optimizer; often mislabeled agent evolution |
| meta-procedure evolution | 4/4 | 4/4 | 2/4 | 2/4 | genuinely novel, still bounded by fixed evaluation |
| generated/co-evolving evaluators | 4/4 | 4/4 | 1/4 | 1/4 | important frontier, unsafe as sole admission gate |
| world-model adaptation | 3/4 | 3/4 | 3/4 | 2/4 | strong for planning under shift, not general autonomy |
| broad-goal autonomous learning | 4/4 | 4/4 | 2/4 | 1/4 | valuable negative result; current reliability is poor |
| lifecycle and matched-search evaluation | 2/4 | 4/4 | 4/4 | 3/4 | high-value control that often changes the winner |

## A practical governed evolution loop

```text
verified task evidence
  -> typed failure hypothesis
  -> smallest candidate change
  -> isolated execution
  -> candidate-specific checks
  -> fresh paired validation + knockout
  -> broad regression, cost, order, and security checks
  -> independent promotion decision
  -> immutable lineage + rollback
  -> monitored deployment
```

Practical rules:

1. Keep proposer and admission authority separate.
2. Change one typed surface per candidate before testing joint changes.
3. Reserve inaccessible cases and record every exposure.
4. Compare every lineage point with the immutable base, not only its parent.
5. Repeat full streams under shuffled, reversed, and interleaved task orders.
6. Test a new skill alone, with the incumbent library, and with it removed.
7. Track utility, latency, token cost, exposure, compromise, and downstream effects separately.
8. Quarantine generated knowledge until provenance and behavioral checks pass.
9. Use model-generated rubrics as advisers unless a fixed anchor confirms them.
10. Prefer external, reversible learning before internalizing behavior in weights.
11. Diagnose whether the task is harness-sensitive; compare matched parallel
    and sequential search before attributing gains to a durable harness.
12. Separate observed-set regression, proposal selection, and inaccessible
    promotion; report disjoint-task transfer.
13. Aggregate failures by recurring mechanism before editing a harness, but do
    not mistake recurrence for causal proof or promotion evidence.

## Highest-value next experiments

1. **Skill admission tournament:** compare immediate append, Bayesian evidence,
   learned curation, and typed static gates on the same generated candidates,
   using paired knockout and mixed-domain streams.
2. **Harness/weight factorial:** frozen base, harness-only, weight-only, and
   joint change with identical data, evaluator, and budget.
3. **Evaluator drift test:** fixed judge, generated rubric, and evolving rubric
   against an inaccessible human/executable anchor; measure disagreement over rounds.
4. **Shared-memory pollution test:** inject plausible false lessons into
   centralized and decentralized topologies; measure diffusion and recovery.
5. **World-model mediation test:** determine whether lower observation-
   prediction error explains action gains, rather than merely correlating with them.
6. **Broad-goal proxy audit:** require an autonomous learner to nominate its
   objective before seeing protected results, then compare terminal selection
   with an immutable base and engineered reference.
7. **Persistent-wiki rollback test:** independently gate raw, wiki, and skill
   layers; inject a plausible false abstraction and measure descendant
   contamination, cross-model transfer, and recovery.
8. **Harness-versus-search tournament:** after a harness-sensitivity screen,
   compare evolution, per-instance harness scaling, parallel sampling, and
   sequential refinement under matched calls, tokens, feedback, and latency.

## Evidence and provenance

The source-agnostic [lead ledger](../reports/research/agent-self-evolution-lead-ledger-2026-09-01.tsv)
contains 984 records with access, provenance, research question, value, novelty,
credibility, related work, disposition, and stopping condition. The companion [Xiaohongshu
resolution ledger](../reports/research/agent-self-evolution-xhs-ledger-2026-09-01.tsv)
preserves all 908 observed stable card IDs and exact body-access states. The [evidence report](../reports/research/agent-self-evolution-autonomy-deep-dive-2026-09-01.md)
separates paper claims, inspected code, bounded local checks, analysis, and
unresolved access boundaries.

Key primary sources include [AgentGym2](https://arxiv.org/abs/2607.05174),
[ARIS](https://arxiv.org/abs/2605.03042), [EvoX](https://arxiv.org/abs/2602.23413),
[CORAL](https://arxiv.org/abs/2604.01658), [RetroAgent](https://arxiv.org/abs/2603.08561),
[Memento-Skills](https://arxiv.org/abs/2603.18743), [HyperAgents](https://arxiv.org/abs/2603.19461),
[Trace2Skill](https://arxiv.org/abs/2603.25158), [Meta-Harness](https://arxiv.org/abs/2603.28052),
[SkillOS](https://arxiv.org/abs/2605.06614), [SkillOps](https://arxiv.org/abs/2605.13716),
[ECHO](https://arxiv.org/abs/2605.24517), [EvoRubric](https://arxiv.org/abs/2605.29847),
[Bayesian-Agent](https://arxiv.org/abs/2606.08348), [Agent-as-a-Router](https://arxiv.org/abs/2606.22902),
[OPID](https://arxiv.org/abs/2606.26790), [AdaJEPA](https://arxiv.org/abs/2606.32026),
[SkillCoach](https://arxiv.org/abs/2607.01874), [PL-HCL](https://arxiv.org/abs/2607.10534),
[SEED](https://arxiv.org/abs/2607.14777), [Co-Harness](https://arxiv.org/abs/2607.22688),
the [world-proxy survey](https://arxiv.org/abs/2608.02713),
[SkillOpt](https://arxiv.org/abs/2605.23904), [SEAGym](https://arxiv.org/abs/2606.17546),
[RHO](https://arxiv.org/abs/2606.05922), the [matched-budget harness critique](https://arxiv.org/abs/2607.12227),
[SkillBoost](https://arxiv.org/abs/2607.26643), [WikiSkill](https://arxiv.org/abs/2608.27454),
[EvoHarness-RL](https://arxiv.org/abs/2608.05446), [Ecdysis](https://arxiv.org/abs/2609.11677v1),
the [statistical-limits paper](https://arxiv.org/abs/2510.04399),
and the [controlled RL-interplay study](https://arxiv.org/abs/2512.07783).
