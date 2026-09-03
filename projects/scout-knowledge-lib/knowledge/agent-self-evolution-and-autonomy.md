<ai_context>
summary: "Agent self-evolution is not one mechanism. The credible core is a governed release loop over explicit mutable surfaces: skills, memory, routing, harness code, weights, world models, curricula, or evaluators. Current evidence is strongest when an external fixed evaluator controls admission; Socratic-Zero and zero-data alternatives show why task generation, learner change, and genuine reciprocal co-evolution must also be separated."
triggers: ["agent self-evolution", "self-improving agents", "recursive self-improvement", "agent autonomy", "skill evolution", "harness evolution", "world models", "co-evolving evaluators"]
last_updated: "2026-09-03"
source_basis: "A source-agnostic 978-row lead ledger: 909 observed cards from the human's Xiaohongshu collection, 61 primary paper, repository, benchmark, and survey records, and 8 existing Scout artifacts; full-text paper review; pinned repository inspection; existing Scout reconciliation; and bounded local code checks. Three authenticated Xiaohongshu bodies were observed and claim-checked; the other 906 cards remain title-level discovery metadata rather than technical evidence."
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
fixed acceptance gate**. Evidence becomes less trustworthy as the proposer and
judge share assumptions, as validation cases are reused, or as the evaluator
itself changes. Broad-goal autonomy remains especially weak: Aspire agents
often completed training or harness-editing loops, but rarely produced a
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
| Artifact-boundary compilation | typed `P`, `K`, or worker in `W` | contrastive traces plus ownership closure | type contract plus correction/preservation replay | omitted requirement makes a narrow boundary appear closed |
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

## Eight comparisons that matter in practice

### 1. Creation, admission, maintenance, and internalization are separate jobs

| Stage | Representative work | Strength | Weakness | Prefer when |
|---|---|---|---|---|
| Create | Memento-Skills, Trace2Skill, MetaClaw | turns experience into reusable procedures | generation quality and attribution are uncertain | failures repeat and artifacts can be inspected |
| Curate/admit | SkillOS, Bayesian-Agent, PL-HCL | controls activation using outcomes or contracts | RL curation is costly; static scans miss runtime behavior | the library is large or evidence is sparse |
| Maintain | SkillOps, later Memento repository | detects duplication, contract drift, and stale structure | measured behavioral gains are modest | library entropy is the bottleneck |
| Internalize | OPID, SEED, SkillRL | removes retrieval cost at inference | training is expensive and errors become parametric | behavior is stable, well verified, and frequently reused |

Creation is not proof of usefulness. Admission is not maintenance. Maintenance
does not show that a skill transfers. Internalization makes rollback harder and
therefore needs a stricter gate than external retrieval.

[AutoRefine](./findings/2026-09-03-arxiv-autorefine-typed-artifact-compilation.md)
adds a prior stage: a contrastive trajectory lesson is compiled into the first
runtime boundary that owns all declared observations, state, decisions, and
completion—a Rule, parent-executed Skill, or bounded Subagent. Contract checks
and correction/preservation replay make the type executable rather than
decorative. The residual risk is specification omission: mechanical closure
cannot test a requirement the model failed to declare.

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

### 3. Adaptive curricula are not automatically data-free or co-evolving

[Socratic-Zero](./findings/2026-09-03-arxiv-socratic-zero-teacher-guided-curriculum.md)
combines a fixed 235B Teacher, a DPO-trained Solver, and a 32B Generator that
distills Teacher problem rewrites weighted near 50% Solver success. Its
frontier-targeted curriculum and historical replay are useful, but its labels
overreach. The experiments use 100 selected MATH seeds, an essential 1,500-
problem MATH SFT bootstrap, and reference answers. More importantly, the
published algorithm adds Teacher—not Generator—outputs to the next Solver
curriculum, so the two trained components do not form a reciprocal loop.

The closest simple causal baseline is LLM2LLM: a strong Teacher creates more
examples from Student failures. Absolute Zero makes a stronger zero-data claim
because Python validates self-proposed executable tasks and answers. R-Zero
trains separate Challenger and Solver policies without seed tasks, but every
tested scale eventually degrades as pseudo-labels and synthetic diversity
decay. These comparisons yield a stricter test: call a system co-evolving only
when each changing component causally affects the other's later learning, and
retain a fixed external anchor against recursive collapse.

### 4. Fixed, generated, and co-evolving evaluators have different evidential weight

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

### 5. Centralized and decentralized sharing exchange speed for contamination risk

| Topology | Examples | Benefit | Risk | Required control |
|---|---|---|---|---|
| Central curator | SkillOS, ARIS | consistent schema and admission | bottleneck and curator bias | versioned proposals, protected gate |
| Shared writable memory | CORAL | fast discovery diffusion | one agent's false lesson spreads quickly | provenance, quarantine, marginal tests |
| Isolated populations | EvoX, HyperAgents | diversity and rollback through archives | duplicated work and expensive evaluation | shared evaluator, lineage, budget accounting |

CORAL's evaluator and worktree isolation are strong. Its shared notes and
skills, however, are directly writable; evaluator isolation protects scores,
not the truth of shared knowledge. Shared memory accelerates both learning and
pollution.

### 6. Task-level and per-step routing address different credit problems

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

### 7. World prediction and policy evolution must be measured separately

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

### 8. Control planes, runtimes, and research optimizers are different layers

[LoopX](./findings/2026-09-03-github-loopx-governed-cross-harness-control-plane.md)
is a provider-neutral control plane above agent harnesses. It owns typed goals,
evidence, gates, actor authority, quotas, claims, recovery, and idempotent
settlement while another harness performs the model turn. Hermes Agent and
OpenClaw are integrated assistant runtimes that also contain durable work,
memory, and skill-learning mechanisms. Arbor is a metric-driven research
optimizer centered on a coordinator-owned hypothesis tree.

LoopX explicitly adapts Arbor's hypothesis–experiment–held-out loop. Its
distinct idea is shared typed state and per-role frontier projection without a
durable leader identity. Four deterministic smokes and its released KNN
evaluator passed locally, establishing plumbing rather than autonomous research
quality. Current Hermes Kanban and OpenClaw Task Flow also narrow the novelty of
durable tasks; LoopX remains strongest when heterogeneous harnesses need one
auditable evidence and authority contract.

For an already supervised system, copy mechanisms rather than platforms:
evidence revisions, retry artifacts, protected promotion, policy/authority
separation, provenance and taint classes, proposal-first skill mutations,
rollback, and explicit no-op states. Do not add a second canonical supervisor.

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
- **AutoRefine** reports TravelPlanner 80.56% against a 50.0% strongest baseline;
  removing boundary closure or replay costs 15.00 and 16.11 points. Its
  SpreadsheetBench gate raises 67.50% to 73.57% while using 2.82× optimizer
  tokens and 3.05× wall time. These are author-reported single-run effects; the
  released deterministic lifecycle passed locally, but full campaigns are not
  shipped.

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

## Novelty and value rubric

Use four independent scores rather than rewarding a new name:

- **Mechanism novelty:** does it change a new object or causal pathway?
- **Decision value:** would it change architecture, evaluation, or deployment?
- **Evidence strength:** are controls, protected tests, repeats, uncertainty, and code available?
- **Operational readiness:** are isolation, admission, lineage, and rollback implemented?

| Cluster | Mechanism | Decision value | Evidence | Readiness | Judgment |
|---|---:|---:|---:|---:|---|
| protected harness evolution | 3/4 | 4/4 | 3/4 | 4/4 | deployable pattern with bounded evidence |
| skill creation + gated admission | 3/4 | 4/4 | 2/4 | 3/4 | high value; coalition and transfer tests missing |
| typed artifact-boundary compilation | 4/4 | 4/4 | 3/4 | 2/4 | strong representation insight; specification and interaction gaps remain |
| per-step skill internalization | 3/4 | 3/4 | 2/4 | 2/4 | promising training method, expensive to reverse |
| adaptive search portfolios | 3/4 | 3/4 | 3/4 | 3/4 | useful optimizer; often mislabeled agent evolution |
| meta-procedure evolution | 4/4 | 4/4 | 2/4 | 2/4 | genuinely novel, still bounded by fixed evaluation |
| generated/co-evolving evaluators | 4/4 | 4/4 | 1/4 | 1/4 | important frontier, unsafe as sole admission gate |
| world-model adaptation | 3/4 | 3/4 | 3/4 | 2/4 | strong for planning under shift, not general autonomy |
| broad-goal autonomous learning | 4/4 | 4/4 | 2/4 | 1/4 | valuable negative result; current reliability is poor |
| adaptive curriculum co-training | 2/4 | 3/4 | 2/4 | 1/4 | useful training controls; Socratic-Zero autonomy and causal claims overreach |
| typed cross-harness governance | 4/4 | 4/4 | 3/4 | 2/4 | strong LoopX design; comparative outcome and maturity evidence still missing |

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
7. **Control-topology comparison:** run Arbor and LoopX on one fixed problem
   with identical models, budgets, and evaluators; measure useful novelty,
   duplicate work, recovery, coordination cost, and held-out outcome.
8. **Artifact-boundary tournament:** give the same contrastive traces to a
   rule-only, skill-only, subagent-only, and ownership-compiled learner; test
   fresh negative boundaries, pairwise artifact interactions, and break-even
   reuse against offline validation cost.
9. **Curriculum topology factorial:** compare fixed-data DPO, Teacher judging,
   Teacher-generated questions, learned-Generator questions, frontier weighting,
   and replay under identical data and compute; continue long enough to measure
   diversity and recursive-collapse onset.

## Evidence and provenance

The source-agnostic [lead ledger](../reports/research/agent-self-evolution-lead-ledger-2026-09-01.tsv)
contains 978 records with access, provenance, research question, value, novelty,
credibility, related work, disposition, and stopping condition. The companion [Xiaohongshu
resolution ledger](../reports/research/agent-self-evolution-xhs-ledger-2026-09-01.tsv)
preserves all 909 observed stable card IDs. The [evidence report](../reports/research/agent-self-evolution-autonomy-deep-dive-2026-09-01.md)
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
[Arbor](https://arxiv.org/abs/2606.11926),
[LoopX](https://github.com/huangruiteng/loopx/tree/ae4887d707e69c19e712c379c4a1ef98b159ae64),
[Hermes Agent](https://github.com/NousResearch/hermes-agent/tree/562ee8ab76a703b7f524172cae0b1d52f9f94bd3),
[OpenClaw](https://github.com/openclaw/openclaw/tree/8a718610bd26ffcffeb04e19641c80e6693731a1),
and [AutoRefine](https://arxiv.org/abs/2601.22758),
[Socratic-Zero](https://arxiv.org/abs/2509.24726),
[Absolute Zero](https://arxiv.org/abs/2505.03335), and
[R-Zero](https://arxiv.org/abs/2508.05004).
