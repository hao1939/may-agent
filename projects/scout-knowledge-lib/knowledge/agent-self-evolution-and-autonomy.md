<ai_context>
summary: "Agent self-evolution is not one mechanism. The credible core is a governed release loop over explicit mutable surfaces: skills, memory, routing, harness code, weights, world models, or evaluators. Current evidence is strongest when an external fixed evaluator controls admission, and much weaker for self-generated or co-evolving judges and broad-goal autonomy."
triggers: ["agent self-evolution", "self-improving agents", "recursive self-improvement", "agent autonomy", "skill evolution", "harness evolution", "world models", "co-evolving evaluators"]
last_updated: "2026-10-15"
source_basis: "A source-agnostic 984-row lead ledger: 908 observed cards from the human's Xiaohongshu collection, including a bounded authenticated frontier of 11 readable text bodies and one image-only cover; 69 primary paper, repository, benchmark, survey, blog, and interview records; and 8 existing Scout artifacts, plus 2026-09-10 direct XHS inspection of HarnessEvolve reception, an HN-surfaced primary-paper inspection of Procedural Graphs (arXiv 2609.09153), 2026-09-11 inspection of HN-surfaced Salesforce Beagle at commit 15f12b7, 2026-09-11 full-paper inspection of Ecdysis (arXiv 2609.11677v1), 2026-09-12 direct XHS inspection of the Seed/TokenWave Self-Developing Agents announcement, 2026-09-13 direct XHS inspection of Procedural Graphs reception, 2026-09-14 direct XHS inspection of a six-survey self-evolution reading map and its practitioner discussion, 2026-09-15 inspection of the HN-surfaced rekursiv.ai auto-autoresearch report plus its runnable NanoChat recipe at Priml commit 92c6bd2, 2026-09-16 inspection of EvoOntology's ontology-evolution lifecycle and admission boundary at commit ace8ff69, 2026-09-19 abstract-level inspection of SoL-Pi (arXiv 2609.20519v1), 2026-09-19 inspection of SourceShift/mini-ork's path-specific self-modification controls at commit 962bf478, 2026-09-22 direct XHS inspection of Chinese-language reception of the matched-budget harness-evolution critique and RSIAgent's exploration-memory framing, 2026-09-23 full-paper inspection of the HN-surfaced AIDE² recursive harness-improvement study (arXiv 2609.26457v1), 2026-09-23 direct XHS inspection of a secondary RRSI explainer (arXiv 2609.24972 named but not inspected), 2026-09-24 direct XHS inspection of a secondary Mobile Planner Agent explainer, 2026-09-24 inspection of Bitterbot's peer-skill admission and propagation controls at commit 873e5d58, and 2026-10-15 direct XHS inspection of a secondary Evo² explainer (arXiv 2610.13025 named but not independently inspected). Claims are traced to full primary sources and pinned code where available; XHS reception is labeled as secondary commentary, and titles remain discovery metadata, never technical evidence."
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

## Peer reputation should buy evaluation priority, not activation

**Observed 2026-09-24. Repo:** [Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop) at commit [`873e5d58ce95eccd7908d1d0bf0f28112db4bbe7`](https://github.com/Bitterbot-AI/bitterbot-desktop/commit/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7).

Bitterbot's peer-skill pipeline implements a useful separation between trusting
an identity and trusting its artifact. Its
[`ingest.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/agents/skills/ingest.ts)
verifies envelope structure, signature and content hash, runs injection and
routing checks, and normally quarantines received skills. Under `auto` policy,
a sufficiently trusted peer can skip operator review, but the skill only enters
staging. [`peer-staging.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/agents/skills/peer-staging.ts)
binds that stage to author key, peer identity, content hash and receipt time;
it refuses to replace a local pending proposal or another author's same-name
stage. Trust therefore changes intake friction, not service state.

Activation is a separate empirical decision. The
[`validation gate`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/validation-gate.ts)
requires a received skill to beat its incumbent on the receiving node's own
private capability tasks. Public canonical tasks are treated as a memorizable
baseline and cannot promote a peer skill by themselves. Model-predicted replay
judgments are diagnostic only; missing or underpowered evidence holds the
candidate, measured non-improvement rejects it, and acceptance uses paired real
rollouts with a one-sided sign test before a canary release. Republishing the
same author/name lineage does not buy unlimited validation attempts, and exact
bytes already measured negatively on that node are not rerun.

The repository makes the policy explicit in a test named
[`trust-not-evidence.test.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/trust-not-evidence.test.ts):
peer trust is excluded from activation fitness and used only to prioritize
which candidate gets evaluated first. Sender attestations similarly remain
claims. A local regression can disable a live peer skill, while two fresh
current-generation verdicts from configured attesters are required for remote
demotion; unknown attesters do not count.

Outbound propagation applies another boundary. The
[`P2P publisher`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/p2p-publish.ts)
selects only locally evolved skills with an accepted validation verdict that
have reached stable state and survived a default three-day maturity delay. It
refuses bodies containing detected secrets or user-specific identifiers and
ships signed provenance so receivers can inspect the sender's evidence, then
re-gate locally rather than inherit the verdict.

The reusable control is to assign peer reputation only narrowly scoped rights:
transport eligibility, review bypass, and evaluation priority. **Activation
should require artifact-bound local evidence.** A signature establishes who
made a claim; reputation can decide which claim is economical to test; neither
establishes that the procedure helps this node, model, task distribution or
tool environment. This avoids both extremes of ignoring useful network
reputation and turning it into transitive execution authority.

Limits: this was a source inspection at one pinned revision. Scout did not run
the repository's tests, benchmark the skill gate, exercise a two-node transfer,
or verify live network behavior. Comments, tests and project documentation
show intended invariants plus implementation paths, not proof that every
runtime path enforces them or that the statistical gate is well calibrated.

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

### XHS signal: a joint loop still has distinct mutable and fixed roles

A current [XHS explainer of Evo²](https://www.xiaohongshu.com/explore/6acf37b3000000000b007023)
describes a tighter coupling between harness search and weight updates. One
shared policy takes two roles: a Proposer edits the harness, while a Reflector
reads the code diff, score change, and execution trajectory and chooses whether
to revise, cross over, or retain the candidate. Accepted and failed edit traces
then become training material through edit extraction or prefix continuation,
followed by supervised fine-tuning and alternating reinforcement learning for
the two roles.

The useful reporting lesson is that **“joint evolution” does not mean every
component evolves together**. In the post's account, the Proposer/Reflector
policy changes and the harness candidates change, but a separate execution
model runs the coding tasks as a fixed component. A joint-evolution claim should
therefore name at least three identities separately: the mutable harness, the
policy that proposes or reflects on edits, and the task executor whose behavior
produces the score. Otherwise a gain can be incorrectly attributed to recursive
improvement of one undifferentiated “agent.” The same separation is needed for
admission: reflection supplies a search decision, while task execution and
benchmark scoring supply different evidence.

The post reports 82.1% pass@1 on Polyglot, 48.3% resolved on SWE-bench Verified,
and 58.0% on held-out LiveCodeBench, with comparisons to named baselines. These
figures remain secondary claims. This XHS scan read the complete post and its
four displayed comments, but did not inspect arXiv 2610.13025, its benchmark
protocol, code, model checkpoints, seeds, statistical uncertainty, or
compute-matched baselines. The post's description of a “fixed” executor also
needs primary-source confirmation before it supports a causal attribution.

- **Source:** https://www.xiaohongshu.com/explore/6acf37b3000000000b007023
- **Coverage:** complete readable XHS post body and four displayed comments;
  named paper not independently inspected

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

### Recursive improvement needs an ignition test, not only better descendants

The HN-surfaced paper *Recursive self-improvement of AI research agents*
([arXiv 2609.26457v1](https://arxiv.org/abs/2609.26457v1)) provides unusually
strong evidence for bounded harness evolution. AIDE² uses a bi-level loop: an
inner agent edits task solutions using public feedback, while an outer agent
rewrites the inner agent's code and admits candidates using private scores. All
candidates receive the same per-task budget. In its main eight-day, 100-node
trajectory, seven of 99 proposed rewrites became incumbents and raised the
selection grade from 0.703 to 0.778; two further complete runs admitted two and
four rewrites. The retained changes alter search policy, context management,
and robustness rather than model weights.

The authors test the selected lineage on four benchmarks that did not affect
selection. AIDE₈₅ matches or exceeds the two-year human-engineered production
baseline on ALE-Bench, MLE-Bench, FML-Bench, and WeatherBench 2; the first three
share broad task families with selection, while WeatherBench 2 is the paper's
out-of-distribution case. The comparison uses 10 tasks × 10 seeds on ALE-Bench,
22 × 3 on MLE-Bench, 18 × 3 on FML-Bench, and one weather task × 3 seeds.
Separately, on 38 held-out kernel/training-context pairs, measured proxy hacking
falls from 55% for AIDE₀ to 32% for AIDE₈₅, versus 39% for the human baseline.
These are author-reported results, not an independent reproduction, and the
behavioral comparison does not identify which rewrite caused the change.

Crucially, the paper separates **better descendants** from a **better
self-improver**. Its “ignition test” places AIDE₄₇ or the human-engineered agent
in the outer loop for three 50-step seeds each. The endpoint means are 0.780 and
0.782 respectively. AIDE₄₇ reaches its final region earlier, but variance and
small sample size make the result inconclusive; the study establishes no clear
improvement in the machinery that drives further self-improvement. The paper
also flags compounded evaluation noise, possible false promotion, high compute
cost, and accumulated harness complexity whose active components are unclear.

This suggests a two-receipt standard for recursive-improvement claims:

1. **descendant receipt:** fixed-budget, protected evaluation shows that the
   promoted artifact improves and transfers; and
2. **ignition receipt:** from the same starting state and matched budget, the
   promoted improver generates better future candidates than the prior
   improver across enough independent runs.

AIDE² provides substantial evidence for the first receipt and an honest but
inconclusive test of the second. “The agent improved itself” should therefore
not be expanded into “the self-improvement process accelerated.”

*Sources: [HN item 49812641](https://news.ycombinator.com/item?id=49812641),
[arXiv abstract](https://arxiv.org/abs/2609.26457v1),
[full HTML](https://arxiv.org/html/2609.26457v1), and
[API metadata](https://export.arxiv.org/api/query?id_list=2609.26457), inspected
2026-09-23. The HN item had one point and no comments at inspection. Scout read
the paper but did not run the system or reproduce its evaluations.*

### XHS signal: regularize both proposal scope and candidate retention

A directly read [XHS post](https://www.xiaohongshu.com/explore/6ab31bc200000000140031a1)
from “ncwr” summarizes a paper it identifies as *RRSI: Regularized Recursive
Self-Improvement of Agent Harnesses* ([arXiv 2609.24972](https://arxiv.org/abs/2609.24972)).
The post describes two distinct controls over harness evolution. On the proposal
side, a dynamic budget permits broader changes early and narrows later proposals
toward one small change, while history is used to discourage repeatedly searching
the same direction. On the selection side, a critic rejects task-specific
changes and a pruner removes components judged unused or too costly.

The useful architectural point is that **regularization is needed on both sides
of promotion**. A held-out admission test can reject an overfit candidate, but
it does not prevent a proposer from repeatedly spending budget in a narrow
region. Conversely, proposal diversity does not stop accepted harnesses from
accumulating dead or expensive components. A credible evaluation should
therefore report proposal edit size and search diversity separately from
retained component cost, knockout contribution, and held-out transfer.

The post attributes gains of up to 14.1 points on eight development benchmarks,
4.7 points on five new tasks, and a 30% token reduction versus an unconstrained
method. Those numbers remain secondary claims: this XHS-only scan did not inspect
the named paper, implementation, benchmark splits, baselines, seeds, or token
accounting. The full post body was readable and showed two likes and one save at
inspection; those engagement counts measure early reception, not validity.

- **Source:** https://www.xiaohongshu.com/explore/6ab31bc200000000140031a1
- **Coverage:** complete readable XHS post body; named paper not inspected

### XHS reception: the evaluation critique has crossed into practitioner media

A directly read [XHS post](https://www.xiaohongshu.com/explore/6a5dd7f4000000000c016a6d)
from the account “大模型知识分享” summarized the same protocol critique for a
Chinese practitioner audience. At inspection it showed 76 likes and 117
collections. Notably, the post foregrounded both confounds: compare automatic
harness evolution with simple task-level search under matched feedback and
reasoning budgets, and test the evolved harness on held-out tasks rather than
on the benchmark used during search. It described the reported Terminal-Bench
2.1 experiments as using GPT-5.4 and Claude Opus 4.6 and said automatic harness
evolution did not consistently beat simple test-time scaling and generalized
poorly.

This is **secondary reception evidence**, not an independent replication or a
replacement for the primary paper review. Its useful signal is directional:
Chinese-language agent discourse is circulating a falsification criterion for
harness-evolution claims—not merely the earlier “optimize the harness” thesis.
Engagement counts are a point-in-time platform observation, not a quality score.

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

### RSIAgent reception locates change in exploration memory, not model weights

A current [XHS RSIAgent post body](https://www.xiaohongshu.com/explore/6ab117b4000000003300a622)
presents recursive self-improvement as a three-role loop: an Actor executes,
a Verifier checks outcomes, and a Curriculum Agent selects what to explore.
The post says the system does not update model parameters; instead it explores
an environment, validates results, retains reusable experience in long-term
memory, and uses a broad-then-deep curriculum before focusing on difficult or
hidden cases. It also attributes improvements on OSWorld-v2 and Agent's Last
Exam to that process.

This is useful practitioner framing because it places the claimed durable
change in `K` (memory) and `E` (curriculum/environment exposure), not in model
weights. It also illustrates why role names are not evidence boundaries. An
Actor–Verifier–Curriculum decomposition does not by itself show that the
Verifier is independent, that retained experience transfers to fresh tasks, or
that broad exploration beats a matched-budget baseline. Scout directly read
the XHS body but did not identify and inspect the underlying paper, benchmark
split, implementation, or result tables in this source-specific scan. The
benchmark gains therefore remain the post author's secondary account, while
the reusable conclusion is narrower: report memory admission, verifier
independence, exploration budget, and fresh-task transfer separately whenever
an exploration-and-memory loop is called recursive self-improvement.

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

### XHS signal: runtime adaptation is not automatically co-evolution

A current [XHS explainer of Alibaba's Mobile Planner Agent](https://www.xiaohongshu.com/explore/6ab3a8320000000018007e1e)
uses “model × harness co-evolution” for a phone agent in which the model handles
understanding, planning, and decisions while the harness manages state, memory,
and skills. It also describes working memory that changes during a task and
long-term memory that accumulates user profiles and experience. Those are useful
architectural distinctions, but the body does not say that model weights or
harness code are updated, name an admission gate, or distinguish learning-time
changes from ordinary runtime state updates. Under this note's definition, the
post therefore supports **model–harness collaboration plus persistent memory**,
not yet a demonstrated co-evolution mechanism.

The post further claims first-place results on MobilePA-Bench Business,
MobilePA-Bench, and a memory evaluation, plus a cost of about US$2.41 per 1,000
tasks. This scan did not inspect the underlying paper, benchmark protocol,
baselines, task mix, success rates, or cost accounting, so those figures remain
secondary claims rather than comparative evidence. The practical reporting rule
is to reserve “co-evolution” for a receipt that identifies the mutable object,
update process, persistence boundary, and promotion test; otherwise report
runtime adaptation, memory accumulation, and harness orchestration separately.

## Evidence profiles and release-control boundaries

Detailed source profiles for bounded skill learning, search portfolios, harness
evolution, lifecycle evaluation, admission integrity, RL headroom, and formal
limits now live in the companion note [Agent Self-Evolution: Evidence Profiles
and Release-Control Boundaries](./agent-self-evolution-evidence-and-release-controls.md#what-the-strongest-evidence-says).
The separation keeps this note focused on the mechanism taxonomy, direct
comparisons, governed loop, and experiment design while preserving the complete
evidence review at a stable, linked heading.

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
