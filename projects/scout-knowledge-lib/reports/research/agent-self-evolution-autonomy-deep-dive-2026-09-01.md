<ai_context>
summary: "Evidence report for a source-agnostic deep investigation of agent self-evolution and autonomy. It reconciles 908 observed Xiaohongshu cards, including a bounded authenticated body frontier, with primary papers, repositories, and prior Scout work; records all 984 leads explicitly; compares mechanisms and alternatives; and separates source claims from direct inspection and analysis."
triggers: ["self-evolution deep dive", "autonomy evidence report", "agent evolution lead ledger", "XHS collection resolution", "skill and harness evolution evidence"]
last_updated: "2026-09-02"
source_basis: "Goal-owned lead ledgers, authenticated observational reads of 11 targeted Xiaohongshu text bodies plus one image-only cover, full primary-paper and discussion review, pinned repository inspections, existing Scout notes, and bounded no-credential code checks. External performance results are attributed, not presented as Scout reproductions."
</ai_context>

# Agent Self-Evolution and Autonomy — Deep Investigation Report

## What was wrong and what changes

The earlier report summarized 48 selected Xiaohongshu cards from a 130-card
checkpoint. That was too shallow for the human's request and too narrow for the
actual collection. It privileged one source, left later cards and related work
outside a common ledger, and sometimes treated a named method as a conclusion
before comparing its mechanism and evidence.

This revision changes the unit of work from “interesting post” to **research
lead**. It records every observed collection card, carries every relevant lead
into primary papers or repositories when identifiable, adds related work found
during investigation, and gives every row a disposition and stopping condition.
The synthesis then compares mechanisms directly instead of repeating titles.

The authenticated follow-up changes several conclusions rather than merely
adding summaries. It resolves the strongest remaining cards to SkillBoost,
SEAGym, WikiSkill, SkillOpt, RHO and its protocol-level critique,
EvoHarness-RL, a formal limits paper, a controlled RL study, and two primary
discussions. The strongest operational change is a stricter evidence contract:
observed-set regression, frozen proposal selection, and inaccessible promotion
are different gates; harness evolution must also beat matched task-level search
and transfer across disjoint tasks.

The result remains deliberately skeptical. “Self-evolving” is retained only
when a durable agent configuration changes. Search-time program evolution, within-
rollout state, adaptive routing, skill-library operations, world-model
adaptation, and policy learning remain valuable, but are not collapsed into one
claim of recursive autonomy.

## Research frontier and lead accounting

The [unified lead ledger](./agent-self-evolution-lead-ledger-2026-09-01.tsv)
contains 984 unique rows:

- 908 Xiaohongshu collection cards with stable IDs;
- 68 paper, repository, benchmark, survey, blog, interview, or other primary-source records; and
- 8 existing Scout notes and reports, each reconciled rather than silently reused.

The companion [Xiaohongshu resolution ledger](./agent-self-evolution-xhs-ledger-2026-09-01.tsv)
preserves the complete observed surface rather than only retained cards. Its
bounded snapshot contains 908 observed of 997 declared collection notes, with
89 unobserved and sorted-ID/newline SHA-256 fingerprint
`f66e7c7611a35fc23a2c35c435905f95a07ed55029554eddf4cd6047ac7e77b6`.
Classification is 163 core, 296 adjacent, and 449 outside this topic.

The human authenticated a dedicated observational browser profile. The bounded
follow-up inspected twelve targeted card details: eleven had readable text
bodies and one high-value card had no extractable text but a targeted cover.
Ten yielded useful technical leads, one harness card contained only hashtags,
and one newly encountered body confirmed an unrelated business case. The other
896 observed cards remain `metadata-only`; the 89-card tail remains unobserved.
No title or snippet was promoted to technical evidence, no neighboring profile
or collection content was used, and no like, comment, follow, collect, message,
setting, or other account/content mutation was performed.

The exact authenticated surfaces were the self-profile collection-note grid,
targeted `/explore/<stable_id>` card details, and `/search_result` recovery when
a selected identity was not materialized in the current grid. Query strings
were kept inside the browser and never recorded. Extraction deduplicated on the
24-hexadecimal-character stable card ID: all 908 ledger identities are unique,
so there are zero duplicate stable-ID rows. A card could appear through more
than one document anchor; those repeated rendering occurrences were collapsed
during observation, and their raw occurrence count was intentionally not
persisted because it has no identity value and would require retaining broader
private-page output.

The stopping condition was evidence saturation, not feed exhaustion: the
predecessor's 906 IDs plus the two newly surfaced IDs account for 908/997, and
the same 89-note unmaterialized tail remains. The follow-up then exhausted the
highest-information ten-card unresolved frontier and both newly encountered
cards at body level, following every useful claim until its mechanism,
strongest comparison, implementation availability, and decisive caveat were
resolved. Repeatedly scrolling or rereading the unchanged tail would add no
identity or body evidence.

Every detail inspected in that frontier has a row in both ledgers. The table
below is the complete body-to-evidence trace, not a sample:

| Stable card ID | Body disposition | Unified evidence path | Saturation or stop |
|---|---|---|---|
| `6a96b1320000000012024529` | useful: SkillOpt | `xhs:…` → `paper:2605.23904` + `code:skillopt` | paper gate, pinned code, and later-package boundary resolved |
| `6a96667100000000290122ae` | irrelevant business case | `xhs:…` only | body established the topic boundary; no technical claim to follow |
| `6a955b35000000000400afaf` | useful: WikiSkill | `xhs:…` → `paper:2608.27454` | mechanism, transfer failures, validation reuse, and no-code boundary resolved |
| `6a8ffe56000000002c03f7ec` | no technical evidence | `xhs:…` only | readable body contained hashtags only; inventing a source was rejected |
| `6a887216000000000b02577a` | useful: RHO and protocol critique | `xhs:…` → `paper:2606.05922` + `code:retro-harness` + `paper:2607.12227` + `code:rethinking-harness-evolution` | protocols, splits, call budgets, candidate distribution, and non-refutation boundary resolved |
| `6a87e8d8000000000c026091` | useful cover: SkillBoost | `xhs:…` → `paper:2607.26643` | mechanism, ablations, transfer, and absence of inspectable code resolved; reopen on implementation release |
| `6a7f5f7b000000002102348b` | useful: statistical limit | `xhs:…` → `paper:2510.04399` | theorem assumptions, threshold, and missing practical capacity proxy resolved |
| `6a7e764f000000002c002f2d` | useful: RSI framing | `xhs:…` → `source:greenblatt-interview` | definition separated from forecasts and empirical evidence |
| `6a753ceb000000002402cae5` | useful: EvoHarness-RL | `xhs:…` → `paper:2608.05446` | base model, teacher, benchmark, evaluator, compute, harness, and unseen-comparison confounds resolved |
| `6a68b3a8000000000f00aa49` | useful: RL capability boundary | `xhs:…` → `paper:2512.07783` + `code:interplay` | causal stage comparison, training-stack identity, and synthetic-domain boundary resolved |
| `6a5ea1bb000000000c003000` | useful: SEAGym | `xhs:…` → `paper:2606.17546` + `code:seagym` | lifecycle protocol, ablations, pinned code, and bounded 161-test implementation check resolved |
| `6a4f9c5f0000000011018ad6` | useful taxonomy; evidence type corrected | `xhs:…` → `source:weng-harness-blog` | primary blog identity resolved; no experimental claim assigned |

The ten useful rows therefore all enter the 984-row unified ledger and reach an
identified paper, repository, or primary discussion. The two non-useful bodies
also remain explicit rather than disappearing. The 16 added non-XHS records
are exactly the papers, code records, and primary discussions named in the
table; this is why the ledger grew from 966 to 984 rows after adding two new
card identities.

The unified ledger's dispositions are intentionally not all “researched”:

Across the 908 XHS rows, disposition prefixes are 53 `deep-dived`, 26
`resolved`, 380 `retained`, and 449 `screened-out`; they sum to the complete
identity set. The 163 core and 296 adjacent rows make the 459 potentially
relevant/control records explicit, while the same 449 screened rows are the
irrelevant boundary.

- out-of-scope cards are screened out with a topic boundary;
- adjacent cards are retained as controls or comparisons;
- ambiguous titles remain unresolved until body or stable primary evidence is
  available;
- named sources link to primary identifiers; and
- selected high-value sources record the deep-dive conclusion and the reason
  further snowballing stopped.

## Method

### Lead resolution

For each lead, the investigation asked:

1. Is the title a real method, a renamed idea, a result claim, or commentary?
2. Can it be linked to a stable paper, repository, benchmark, or discussion?
3. What object changes—context, skill, router, harness, policy, world model,
   environment, evaluator, or improvement procedure?
4. Is the change durable, and does it affect the deployed agent or only the
   task artifact/search state?
5. Who proposes, evaluates, admits, and deploys it?
6. What is the closest alternative, and what evidence separates them?
7. What result would falsify the claimed advantage?

### Evidence snowballing and saturation

Papers were followed to mechanisms, ablations, limitations, code, and direct
competitors. Snowballing stopped when the mutable object and evaluator were
resolved, the strongest nearby alternatives were compared, the evidence limits
could be stated, and another citation would add only another implementation of
the same causal pattern. New mechanisms—such as posterior-gated skills,
metacognitive mutation, per-step skill credit, generated rubrics, or adaptive
world models—were added as their own leads.

This is bounded saturation, not a claim that the fast-moving literature is
complete. The exact open paths remain in the ledger rather than disappearing
from the narrative.

### Evidence grades

| Grade | Meaning |
|---|---|
| Direct | Scout inspected pinned code or executed a bounded local path |
| Primary-reported | paper tables, methods, or limitations were read; result not reproduced |
| Secondary | collection card, discussion, or survey used for discovery/context |
| Analysis | cross-source inference made here; not attributed to a source |

## Source and claim map

| Source | What was checked | Main supported claim | Important limit |
|---|---|---|---|
| [AgentGym2 `2607.05174`](https://arxiv.org/abs/2607.05174) | full paper | realistic hidden/noisy tool conditions materially lower agent performance | benchmark, not evolution method |
| [ARIS `2605.03042`](https://arxiv.org/abs/2605.03042) + [repo](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep) | paper, current code, historical XHS-date code | durable research graph, failed-idea memory, proposed meta-optimization and approval | one uncontrolled eight-hour trajectory; no efficacy proof |
| [EvoX `2602.23413`](https://arxiv.org/abs/2602.23413) | full paper | search strategy can adapt parent/operator/inspiration choices | fixed task evaluator; solution search, not general self-rewrite |
| [CORAL `2604.01658`](https://arxiv.org/abs/2604.01658) + [repo](https://github.com/facebookresearch/CORAL) | paper and code | long-lived agents share attempts/knowledge while evaluator worktrees remain isolated | shared knowledge is directly writable and can pollute peers |
| [RetroAgent `2603.08561`](https://arxiv.org/abs/2603.08561) | full paper and repo | weights and explicit lessons can improve together | simulator/task-family bounded; model oracle used in analysis |
| [Memento-Skills `2603.18743`](https://arxiv.org/abs/2603.18743) | paper and current repo | learned routing plus writable skills can improve benchmarks | most GAIA skills did not transfer; later gates postdate paper |
| [HyperAgents `2603.19461`](https://arxiv.org/abs/2603.19461) | full paper | task and meta-agent code can co-mutate and transfer improvement procedures | fixed tasks/evaluators and bounded 100-iteration searches |
| [Trace2Skill `2603.25158`](https://arxiv.org/abs/2603.25158) | full paper | artifact-aware multi-trace diagnosis transfers better than one log-only call | default applies consolidated patches without per-patch gate |
| [Meta-Harness `2603.28052`](https://arxiv.org/abs/2603.28052) | full paper | selective access to raw traces/full history improves harness search | frontier proposer and very large diagnostic footprint |
| [SkillOS `2605.06614`](https://arxiv.org/abs/2605.06614) | full paper | learned curator can outperform simple memory baselines | 16×H100 training; compatibility and negative transfer |
| [SkillOps `2605.13716`](https://arxiv.org/abs/2605.13716) | full paper | typed library maintenance is cheap and useful | narrow, partly synthetic PDDL-heavy evaluation; small drop-in gains |
| [ECHO `2605.24517`](https://arxiv.org/abs/2605.24517) | full paper | terminal outputs can become dense on-policy prediction targets | large relative gain from low absolute TerminalBench baseline |
| [EvoRubric `2605.29847`](https://arxiv.org/abs/2605.29847) | full paper | evolving rubrics can densify open-ended RL feedback | policy–rubric coupling; external meta-verifier still anchors it |
| [Bayesian-Agent `2606.08348`](https://arxiv.org/abs/2606.08348) | full paper | posterior evidence can prevent one-failure skill patching | token-heavy and limited model/harness coverage |
| [Agent-as-a-Router `2606.22902`](https://arxiv.org/abs/2606.22902) | full paper | execution feedback reduces model-routing information deficit | cached benchmark and estimated provider costs; models stay fixed |
| [OPID `2606.26790`](https://arxiv.org/abs/2606.26790) | full paper | episode and critical-step skills provide denser on-policy credit | no repeated-run uncertainty located in reviewed results |
| [AdaJEPA `2606.32026`](https://arxiv.org/abs/2606.32026) | full paper | online latent prediction updates improve replanning under shift | controlled visual environments; policy itself is not updated |
| [SkillCoach `2607.01874`](https://arxiv.org/abs/2607.01874) | full paper | final success can hide wrong skill selection and repair | offline SFT only; selected benchmarks |
| [PL-HCL `2607.10534`](https://arxiv.org/abs/2607.10534) | full paper | static cross-layer scanner can detect malformed skills | cannot establish runtime usefulness or safety |
| [SEED `2607.14777`](https://arxiv.org/abs/2607.14777) | paper and code | skills can be privileged training context then disappear at inference | teacher bootstrap and shared actor/analyzer bias |
| [Co-Harness `2607.22688`](https://arxiv.org/abs/2607.22688) | full paper | alternating harness repair and SFT can compound over two rounds | math-only, large compute, human structural redesign |
| [world-proxy survey `2608.02713`](https://arxiv.org/abs/2608.02713) | full survey | prediction, execution, memory, skill, and verification proxies can be mapped separately | taxonomy is not empirical validation; “world model” may stretch too far |
| [AgentStream `2608.00155`](https://arxiv.org/abs/2608.00155) | paper and pinned code | experience transfer depends on model, method, order, and mixture | model campaigns not reproduced locally |
| [Aspire `2608.31111`](https://arxiv.org/abs/2608.31111) | full paper tables/trajectories | broad-goal learners often complete updates without retained improvement | new result; one retained gain reused a fixed feedback slice |
| [SkillOpt `2605.23904`](https://arxiv.org/abs/2605.23904) + [repo](https://github.com/microsoft/SkillOpt) | paper, pinned code, later Sleep preview | bounded document edits, held-out selection, and rejected-edit memory are stronger than immediate append | Sleep deployment claims are later than the paper; final adoption still needs real protected tasks |
| [SEAGym `2606.17546`](https://arxiv.org/abs/2606.17546) + [repo](https://github.com/antropy-research/SEAGym) | paper, code, 161-test local run | train/validation/ID/OOD/replay/cost views expose overfit and forgetting | evaluation infrastructure, not a new evolution method; provider campaign not reproduced |
| [RHO `2606.05922`](https://arxiv.org/abs/2606.05922) + [repo](https://github.com/wbopan/retro-harness) | paper tables/method, pinned code | label-free proposal from resettable past trajectories can improve held-out tasks | self-preference is not consistently discriminative; Meta-Harness comparison is not call-matched |
| [harness-evaluation critique `2607.12227`](https://arxiv.org/abs/2607.12227) + [repo](https://github.com/rethinking-harness-evolution/code) | primary HTML/results and pinned code | matched parallel/sequential search often beats AHE-style evolution; disjoint transfer is small | protocol-level challenge, not a direct RHO replication or refutation |
| [SkillBoost `2607.26643`](https://arxiv.org/abs/2607.26643) | full HTML, gate ablations, repository search | typed repairs plus `Fix−Regress>0` and bounded regression reject harmful edits | admission reuses the observed set; no inspectable implementation found |
| [WikiSkill `2608.27454`](https://arxiv.org/abs/2608.27454) | full paper, results, code search | a structured wiki helps proposal more than direct inference and can transfer | wiki never rolls back; small reused validation sets and catastrophic transfer exist; no official code found |
| [EvoHarness-RL `2608.05446`](https://arxiv.org/abs/2608.05446) | full paper and comparison audit | joint harness/weight training can make an 8B model strong on ALFWorld | “matches Opus” is confounded by Opus teaching, unequal harnesses/compute, and missing unseen Opus result |
| [statistical limits `2510.04399`](https://arxiv.org/abs/2510.04399) | theorem and assumptions | repeated adaptive selection needs capacity-aware independent evidence | fixed IID envelope and unknown practical capacity proxies limit deployment use |
| [RL interplay `2512.07783`](https://arxiv.org/abs/2512.07783) + [repo](https://github.com/Interplay-LM-Reasoning/Interplay-LM-Reasoning) | paper and pinned training stack | RL expands capability conditionally at the competence edge with pretraining headroom | controlled synthetic tasks; heavy GPU reproduction not run |
| [Lilian Weng harness essay](https://lilianweng.github.io/posts/2026-07-04-harness/) | primary blog | useful taxonomy; evaluator and permissions should remain outside the evolving loop | secondary synthesis, not the paper or experiment claimed by the card |
| [Ryan Greenblatt interview](https://www.dwarkesh.com/p/ryan-greenblatt) | primary participant discussion | RSI can mean automating successor-model R&D rather than self-editing weights | timelines and transfer from verifiable R&D tasks are forecasts, not empirical evidence |

The unified ledger holds additional baselines and implementation records,
including AgentFlow, RLTF, SkillRL, Continual Experience Internalization,
Self-Harness, Harness-Bench, HarnessOpt-Bench, HarnessCompass, SkillRise,
the task-order and CASS controls, the financial-agent safety audit,
AgentEvolver, MetaEvolve, EnvHarness, HELIX, Agentic Harness Engineering,
RecHarness, and skill-evolver.

## Direct comparisons and conclusions

### Skill lifecycle

The literature often treats “skill evolution” as one method, but the reviewed
systems cover four different problems:

- Memento-Skills, MetaClaw, and Trace2Skill **create** procedures.
- SkillOS, Bayesian-Agent, and PL-HCL **curate or admit** them.
- SkillOps and later Memento code **maintain** library contracts.
- OPID, SEED, and SkillRL **internalize** guidance into policy weights.

This comparison changes the practical choice. Use an external skill first when
rollback and inspection matter. Add evidence-aware admission when the library
or failure stream grows. Add maintenance when redundancy and interface drift
become visible. Internalize only stable, frequently reused procedures because a
bad external file is easier to remove than a bad weight update.

The authenticated leads make admission more precise. SkillOpt uses separate
optimization, held-out selection, and final test reporting; its later Sleep
package stages human adoption and must not be backported into the paper's
evidence. SkillBoost's observed-set gate is strong regression protection but
not independent proof of generalization. WikiSkill shows that gating only the
derived skill is insufficient when an upstream wiki persists after rejection.
The practical unit of rollback is every durable knowledge layer that can shape
future proposals.

### Harness, weights, and joint change

Self-Harness and Meta-Harness isolate harness search around fixed models.
AgentFlow, RLTF, and ECHO update weights around a fixed harness. RetroAgent,
SkillRL, and Co-Harness couple layers. Joint change can unlock gains neither
layer finds alone, but it destroys simple attribution. A credible joint result
therefore needs a four-cell factorial: frozen, harness-only, weight-only, and
joint, with identical data and evaluator. Co-Harness currently reports strong
two-round gains but not that full causal comparison across domains.

AgentEvolver, MetaEvolve, EnvHarness, and HELIX expand the joint design space
through task generation, learned program refinement, environment wrapping, and
typed sibling trajectories. Their reported gains are useful leads, but they do
not add cleanly: once policy, harness, data, and environment all move, a fixed
anchor and staged ablations are the only way to preserve causal identity.

RHO adds a useful retrospective path: choose a difficult/diverse ten-task
coreset, sample three rollouts and three proposals, and diagnose by self-
validation/self-consistency. Its held-out gains support candidate generation,
but not a clean promotion victory: SWE-Bench Pro self-preference selects 0.78
while three candidates average 0.79, and its 103-call one-round comparison is
not equal compute to Meta-Harness at 41 or 320 calls. The later critique asks a
different but decisive question—does durable evolution beat using the same
feedback and `K=5` rollouts directly on each task? Often it does not. Because
that study evaluates AHE-style evolution rather than RHO, the correct synthesis
is a protocol requirement, not a claimed refutation.

EvoHarness-RL further shows why layer attribution matters. Qwen3-8B's 96.9%
seen and 86.6% unseen ALFWorld scores follow 87 successful Opus teacher
trajectories, Opus consolidation each epoch, 150 GRPO epochs, and eight H200s.
Claude Opus 4.5 scores 96.4 with ReAct and 98.5 with the same BPE harness; no
Opus unseen score is given. This is a strong domain-specific training result,
not equal-budget 8B parity.

### Evaluator authority

Fixed hidden or executable evaluators provide the clearest admission evidence.
Generated rubrics can supply dense feedback and discover missing criteria, but
the proposer and judge may share blind spots. A different model is diverse, not
independent. Genuine evaluator co-evolution without an immutable anchor remains
mostly a proposal; CORAL explicitly leaves it to future work. No reviewed
evidence justifies giving a co-evolving judge sole promotion authority.

Observed-set regression, frozen selection, and inaccessible promotion now form
three distinct authorities. SEAGym supplies the lifecycle bookkeeping;
SkillBoost supplies a concrete incumbent-regression rule; SkillOpt demonstrates
held-out proposal selection; and the harness critique supplies matched-search
and disjoint-transfer controls. None alone is the full admission contract.

### Sharing topology

Centralized curation makes schema and rollback easier but concentrates bias.
Decentralized writable state, as in CORAL, spreads useful findings faster but
also spreads plausible falsehoods. Population archives, as in EvoX and
HyperAgents, preserve diversity and lineage at high evaluation cost. The
practical missing experiment is a controlled pollution injection that measures
diffusion, detection, and recovery across these topologies.

### Routing and credit granularity

Agent-as-a-Router learns which model should receive an entire task. OPID learns
which hindsight skill should influence a critical step during training. These
are complementary, not substitutes. Task routing reduces model-selection
regret; per-step routing attacks long-horizon credit assignment. Both require
outcome feedback, but only OPID changes the executor's weights.

### World model versus policy

ECHO shares parameters between action policy and terminal-output prediction;
AdaJEPA updates a separate latent predictor used by planning. Both exploit
environment feedback, but better prediction is not itself better action. A
causal evaluation should report prediction error, plan quality, action success,
and mediation between them rather than using “learns a world model” as a single
performance claim.

### RL capability is conditional on pretraining headroom

The controlled synthetic Interplay study resolves neither extreme slogan. RL
can expand pass@128 when pretraining supplies the needed primitives, leaves
headroom, and places tasks near the competence edge. It does little when the
primitives are absent or the task is saturated, and targeted mid-training often
dominates RL-only under fixed compute. The official stack exposes stage-specific
configs and checkpoints, but a GPU-scale reproduction was disproportionate and
the synthetic-domain boundary remains explicit.

## Novelty and value judgments

The [canonical synthesis](../../knowledge/agent-self-evolution-and-autonomy.md)
scores clusters on mechanism novelty, decision value, evidence, and operational
readiness. The strongest judgments are:

1. **Protected harness evolution is useful now.** Its novelty is moderate, but
   isolation, typed diffs, regression gates, lineage, and rollback are directly
   actionable.
2. **Skill admission is more valuable than another unconstrained generator.**
   The open technical gap is marginal and mixed-stream validation, not fluent
   lesson production.
3. **Metacognitive mutation is genuinely different.** HyperAgents changes the
   procedure that creates future changes, unlike EvoX's strategy selection, but
   current evidence remains benchmark-bounded.
4. **Generated evaluators are novel and high leverage but low confidence.**
   They should propose or triage, not decide deployment alone.
5. **World-model adaptation has credible bounded value.** It improves planning
   under shift, but does not imply goal autonomy or general self-evolution.
6. **Aspire's negative result is unusually valuable.** It shows that choosing a
   useful proxy and terminal checkpoint is harder than completing an update.
7. **Matched-search evaluation can reverse the winner.** SEAGym makes the
   lifecycle measurable; the harness critique shows that evolution can lose to
   simpler use of the same inference budget.
8. **Persistent knowledge needs its own release boundary.** WikiSkill's wiki
   improves proposals but survives rejected descendants and sometimes transfers
   catastrophically.

For the newly body-resolved high-value choices, the operational comparison is:

| Choice and strongest alternative | Prerequisite and cost | Evidence and advantage | Disadvantage, risk, or failure mode | Prefer when / readiness |
|---|---|---|---|---|
| SkillOpt versus immediate skill append | separable optimization/selection tasks and repeated model calls | held-out selection, bounded document edits, rejected-edit memory; paper reports +23.5 points over no-skill GPT-5.5 | selection still needs genuinely protected deployment tasks; later Sleep claims are not paper evidence | use for reversible document skills when a clean selection split exists; medium-high readiness because code is inspectable |
| SkillBoost versus SkillOpt or incumbent/knockout release gates | typed failure attribution, `N` repair candidates, and full observed-set back-tests | 23 reported configurations, gate ablations, and transfer; explicitly rejects fixes whose regressions dominate | observed-set reuse is not independent promotion; no released code, so the invariant was not implementation-verified | use its rule as regression screening, not sole promotion, when failures localize cleanly; medium decision value, low-medium readiness |
| WikiSkill versus transactional skill-only storage | persistent raw experience, wiki synthesis, skill derivation, and repeated validation calls | structured wiki improves proposals and reports cross-model transfer | wiki survives rejected skills, small validation sets are reused, catastrophic transfer occurs, and no official code was found | prefer only when every persistent layer can be versioned, gated, and rolled back; otherwise choose a transactional skill store; low readiness |
| RHO versus Meta-Harness and matched per-task search | resettable past trajectories, a 10-task coreset, 3 rollouts × 3 proposals, and a GPT-5.5 solver/judge/ranker | held-out gains support label-free candidate generation | self-preference loses to the candidate mean on SWE-Bench Pro; 103 calls versus 41/320 makes the Meta-Harness comparison round-matched, not compute-matched | prefer for offline proposal from resettable history; require matched parallel/sequential search and an external promotion gate; medium readiness |
| SEAGym plus the harness-evaluation protocol versus endpoint-only benchmark scores | train/validation/ID/OOD/replay/cost splits, snapshots, repeated runs, and matched `K=5` budgets | released lifecycle code passes 161 tests; the critique shows simpler search can reverse the winner and disjoint transfer averages only +0.6 | evaluation infrastructure adds campaign cost and does not itself improve an agent; critique tests AHE-style evolution, not RHO | prefer before investing in durable harness evolution, especially when harness sensitivity is unknown; high decision value, medium-high readiness |
| EvoHarness-RL versus frozen, harness-only, or weight-only cells | Opus teacher trajectories/consolidation, 150 GRPO epochs, eight H200s, and ALFWorld-specific BPE harness | strong reported 8B domain result and an example of joint optimization | unequal teachers, harnesses, and compute destroy the “8B matches Opus” attribution; unseen Opus result and repeated-run uncertainty are absent | prefer only for funded domain specialization after a four-cell factorial; low general readiness despite an inspectable method description |
| Statistical Two-Gate bound versus behavioral release gates | fixed-distribution IID cases, bounded loss, independent validation, one mutable axis, and an ex-ante hypothesis envelope | formalizes evidence consumption under repeated adaptive selection | modern harness capacity is unknown and assumptions exclude many open adaptive settings | use as a warning that protected evidence is finite; use paired behavioral gates for actual release; low operational readiness |
| Competence-edge RL versus targeted mid-training | pretrained primitives, measurable headroom, training compute, and stage-matched evaluation | controlled synthetic tasks isolate when RL expands pass@128 | RL adds little without primitives or near saturation; mid-training often wins at fixed compute; external validity and GPU cost remain | diagnose headroom first; prefer mid-training for missing primitives and RL for reachable-but-rare combinations; medium evidence, low local reproducibility |

The Weng blog and Greenblatt interview are retained as taxonomy and scenario
framing, not operational alternatives: neither supplies a tested mechanism or a
promotion rule.

## What changed and what retained predecessor provenance

Materially changed or strengthened conclusions are limited to six points: the
three-way split between observed-set regression, frozen proposal selection, and
inaccessible promotion; RHO's support for proposal generation but not reliable
self-preference admission; the requirement to compare harness evolution with
matched task-level search and disjoint transfer; WikiSkill's unrolled-back wiki
as a contamination channel; the downgrade of “8B matches Opus”; and the
conditional competence-edge account of RL capability. SkillBoost adds strong
reported regression-gate evidence but stays below code-backed readiness.

The predecessor's six-coordinate definition, mutable-object taxonomy,
preference for reversible external skills before weight updates, skepticism of
co-evolving judges, separation of search from deployed-agent change, and
shared-memory contamination warning were retained. Their existing citations
remain in place; they were not rewritten as discoveries of this follow-up.

## Contradictions resolved

1. **“Self-evolving” versus search.** EvoX and CORAL improve a search process
   under a fixed evaluator; the deployed general agent need not change.
2. **“Cross-model review” versus independence.** ARIS gains heterogeneous
   critiques, but reviewers can share data and assumptions; only an external
   outcome anchor can make admission independent.
3. **“More memory helps” versus exploration.** RetroAgent's half-group result,
   SkillOS negative transfers, and AgentStream interleaving show that guidance
   can suppress exploration or transfer the wrong rule.
4. **“Success proves correct skill use.”** SkillCoach demonstrates that agents
   can select or compose skills incorrectly and repair the final answer ad hoc.
5. **“World prediction is policy improvement.”** ECHO and AdaJEPA expose two
   distinct causal paths; each requires downstream behavioral evidence.
6. **“A completed update is improvement.”** Aspire repeatedly produces valid
   checkpoints that fail to beat the immutable base.
7. **“A cleaner skill library is a better agent.”** SkillOps improves library
   quality, but its drop-in behavioral gains are modest and domain-specific.
8. **“Recursive means unbounded.”** HyperAgents changes its improvement code,
   yet still runs inside fixed tasks, evaluators, archives, budgets, and human
   controls.
9. **“A regression gate proves generalization.”** SkillBoost can reject edits
   that hurt observed tasks, but promotion still needs inaccessible evidence.
10. **“Self-preference is a reliable admission gate.”** RHO's candidate
    generation helps, but on SWE-Bench Pro its selected candidate is below the
    three-candidate mean.
11. **“Harness evolution beats test-time scaling.”** The matched-budget critique
    often favors parallel or sequential task search and finds little disjoint
    transfer; it challenges the protocol, not RHO specifically.
12. **“8B matches Opus.”** EvoHarness-RL uses Opus teaching, Opus consolidation,
    large RL compute, and a different default harness; same-harness Opus is
    higher on seen tasks and unseen Opus is unreported.
13. **“RL only refines” versus “RL creates.”** Controlled results support a
    conditional answer: RL expands reachable combinations only with suitable
    primitives and competence-edge headroom.

## Focused direct checks already completed

All execution occurred in goal-owned scratch space, never the dirty source
checkout or another worker's worktree.

### Harness-Bench

Pinned source: `Qihoo360/harness-bench@1025086a446653702b80cfb48babbeec35db6b2c`.

```text
PYTHONPATH=src python3 -m harnessbench.cli tasks
  -> exit 0

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 <integrity check>
  -> loaded_tasks=106; ID/prompt/oracle problems=[]

HARNESSBENCH_SKIP_PROCESS_GRADE=1 \
HARNESSBENCH_SKIP_ORACLE_QUALITY_LLM=1 \
PYTHONPATH=src python3 -m harnessbench.cli run-task \
  --task 001-file --harness demo-local --mode demo
  -> exit 0; adapter_ok=true; elapsed=0.506s; oracle score=1.0
```

This proves task loading and one sandbox→adapter→oracle path, not any reported
model ranking or the paper's 5,194 trajectories.

### AgentStream

Pinned source: `microsoft/Sico@3b2e0281faa89fd3c183b82b38ed009f25a13de6`,
sparse path `labs/AgentStream`.

The repository self-test was blocked before test logic by missing local
`pydantic`. A standard-library abstract-syntax-tree extraction ran the exact
ordering helpers and found:

```text
deterministic=true
seed_changes_interleave=true
within_order_preserved=true
all_tasks_once=true
method_runners_checked=5
```

This validates the released ordering contract, not the model scores. Installing
one convenience dependency would not reproduce six benchmark environments,
provider credentials, or the original model-call campaign.

### skill-evolver

Pinned source: `FishSerrie/skill-evolver@de0b552…`. Its isolated test run
executed 879 tests: 877 passed and 2 failed. The failures remain evidence, not
silently waived. The implementation demonstrates transactional skill staging,
checks, atomic deployment, backups, and rollback; the test result and absence of
a comparative capability campaign prevent an efficacy claim.

### SEAGym

Pinned source: `antropy-research/SEAGym@9e61e14db1f1355de944cd7c5b10c244fc74e82d`.

The documented `python` command first failed at the shell boundary because this
environment exposes only `python3`; this was missing convenience wiring, not a
missing runtime. The equivalent standard interpreter command then ran the full
released suite:

```text
python3 -m unittest discover -s tests
  -> Ran 161 tests in 0.474s
  -> OK (skipped=7)
```

The tests exercise split validation, batch planning, baseline updates,
checkpoint/resume, update-validation, replay/cost metrics, Harbor-result
adapters, scheduling, and report generation. This validates the released
deterministic lifecycle implementation, not the paper's provider-backed AHE,
ACE, or TF-GRPO scores.

### New code-bearing primary sources

SkillOpt was inspected at
`microsoft/SkillOpt@db46cd9ae7ce12f1dbd73c945185816aa738751d`.
The default gate requires strict hard-score improvement; optional soft/mixed
metrics and a semantic-density bonus do not change that default. The later
SkillOpt-Sleep preview is version-separated from the paper implementation.

The RHO implementation was inspected at
`wbopan/retro-harness@e5f2d1a8a06ab3523ab42e0042d2fa13d9acb701`, and the
matched-search critique at
`rethinking-harness-evolution/code@62df2b9624ff32ca61b8accce7fb4a0fd8cbc8a8`.
They expose materially different protocols: retrospective coreset proposal
versus direct/parallel/sequential/AHE-style budget comparisons. Running either
benchmark campaign would require provider credentials, models, and benchmark
environments, so no performance reproduction is claimed.

The RL-interplay stack was inspected at
`Interplay-LM-Reasoning/Interplay-LM-Reasoning@ab728f05d81de9af38d0ca155a84166b037e355a`.
It includes stage-specific LLaMA-Factory and verl/GRPO configs, synthetic data
tools, an evaluation runner, and released checkpoint links. Its documented
Python 3.12, PyTorch 2.7.1/CUDA, model-training, merge, and evaluation path is
inspectable but not a bounded CPU reproduction.

SkillBoost has no project/code URL in its metadata or full HTML, and bounded
GitHub searches by title, method, and arXiv ID found no implementation as of
2026-09-02. Its acceptance invariant and ablations therefore remain primary-
reported rather than implementation-verified.

## Repository validation

- `bun --cwd=projects/scout-knowledge-lib.app run check` exited 0. It bundled
  the application and workflows, passed TypeScript and Prettier checks, and ran
  78 tests with 0 failures and 226 assertions.
- A standard-library TSV validator read all records at their declared widths:
  908 unique XHS IDs across 9 columns and 984 unique unified lead IDs across 14
  columns. Every unified row has a research question. It also reproduced the
  163 core / 296 adjacent / 449 out-of-scope split and 896 metadata-only / 11
  readable-body / 1 image-only-cover access counts.
- A scoped resolver found 0 missing relative links across the two changed
  Markdown documents. HTTP checks returned 200 for all 17 newly cited arXiv,
  blog, interview, and GitHub targets after correcting SEAGym's repository
  owner from the paper team name to `antropy-research`.
- `git diff --check` exited 0.
- The read-only library-health command, run with explicit clock
  `2026-09-02T00:00:00Z`, completed and returned a bounded, truncated packet of
  24 inherited facts:
  future-dated files, oversized notes, and the existing unsourced index backlog.
  None names a file added or rewritten by this goal, so the packet is disclosed
  rather than misrepresented as global library health.

## Remaining limits

- The bounded authenticated Xiaohongshu frontier is resolved, but 896 observed
  cards remain metadata-only and the final 89 declared cards remain
  unobserved. This does not imply that all contain relevant bodies; it preserves
  the exact access boundary without bulk private-surface extraction.
- Many 2026 papers are recent preprints. Results are author-reported unless a
  direct check above says otherwise.
- No deep-learning campaign was reproduced locally. The environment lacks the
  required model weights, provider calls, benchmark services, and large GPU
  budgets; those are capability boundaries for reproduction, not blockers to
  source analysis.
- The 984-row ledger is complete for the bounded encountered frontier, not for
  every paper that could exist. Each unresolved or deferred row includes the
  evidence that would reopen it.
- Existing Scout notes were reused for task-order, SkillRise, memory governance,
  and harness evidence. This focused report does not take ownership of the
  standing Scout loop or its future collection snapshots.

## Integration scope

This follow-up extends the unified and XHS ledgers and updates only the material
conclusions in the canonical note and report. It does not push, merge, deploy,
mutate the observed account/content, or edit the dirty source checkout.
Repository validation is recorded above; the exact diff remains reviewable on
the local goal branch.

## Acceptance audit and safe handoff

This finite acceptance audit began from clean commit
`8f611fec0adb19a6a44ac0202c094fe30ee298de`, whose parent and merge base are the
accepted predecessor revision `8c5d8747a6b4be8d65703792911360a9082d8b51`.
The reviewed predecessor-to-candidate diff is confined to the canonical
synthesis, this report, and the two ledgers: 346 insertions and 76 deletions at
the audit start. No index, application code, or external service changed.

| Acceptance criterion | Durable evidence and disposition |
|---|---|
| Complete per-card identity, access, deduplication, relationship, and disposition | XHS ledger header plus all 908 stable-ID rows; the twelve non-metadata rows and body-to-evidence table above are the complete detail frontier, while 896 metadata-only and 89 unobserved remain explicit. |
| Exact coverage, duplicates, boundaries, and stop | “Research frontier and lead accounting” records the three UI surfaces, 908/997 identities, zero duplicate stable-ID rows, scope/access counts, the 89-card boundary, and evidence-saturation stop without treating metadata as evidence. |
| Every useful body claim snowballed | The complete twelve-row trace above maps ten useful claims to all 16 added paper/code/discussion rows and gives each saturation or reopening condition; two non-useful bodies remain explicit controls. |
| Novelty, value, evidence, readiness, and alternatives | “Direct comparisons,” “Novelty and value judgments,” and the operational comparison table state prerequisites, results, cost, advantages, risks, failure modes, preferred conditions, and readiness. |
| Claim-type separation | “Evidence grades,” “Source and claim map,” per-row `provenance`/`access`/`credibility`, and the direct-check sections separate XHS discovery claims, primary reports, inspected code, bounded runs, Scout analysis, forecasts, and unknowns with dated stable IDs. |
| Only material synthesis changes | “What changed and what retained predecessor provenance” names the six changed conclusions and the retained framework; the four-file diff is based directly on the accepted predecessor commit. |
| Consequential bounded checks | “Focused direct checks” gives pinned revisions, exact Harness-Bench and SEAGym commands/results, the AgentStream ordering facts, the skill-evolver failures, and explicit provider/GPU boundaries. The exact one-off AgentStream extraction and inherited skill-evolver invocation were not retained, so those two are evidence records rather than copy-paste reproductions; no stronger claim depends on them. |
| Clean, reviewed, valid candidate | “Repository validation” records the repository suite, schema/identity/count/fingerprint checks, relative and external links, diff check, and all 24 inherited health facts. The final post-audit commit and clean-state proof are supplied in the handoff because a commit cannot contain its own hash. |
| Plain-language report and integration | “What was wrong and what changes,” “Remaining limits,” and this section provide scope, proof, limits, and procedure. If the target contains `8c5d8747…`, cherry-pick the follow-up commit range through the final reported tip; otherwise merge the complete goal branch after reviewing the same four-file diff. |

The XHS helper was also audited as code. Its allowlist performs navigation,
scrolling, targeted stable-ID extraction, and relevant-cover capture; it has no
cookie/storage read, request-body submission, account-action endpoint, or
credential export. Navigation clicks are label-restricted, detail output
returns pathname rather than query, and the only persisted authenticated media
is the relevant admission-gate cover in goal-owned volatile scratch. The
repository diff contains no signed XHS URL, query parameter, cookie, token,
message, full page/body dump, profile metadata, or unrelated private content.
The human-provided Windows browser profile was neither copied nor inspected.

Before this audit edit, a read-only `GIT_OPTIONAL_LOCKS=0` snapshot recorded the
starting `/app` worktree at `386b445c236e4609cd8870d22cc773cc4641fec8`
with its pre-existing 881 status records (status-output SHA-256
`91e199b7c8b0603e98bb52203f841ac7e8d0d6c2b29a8ead11b20124fa2d925f`).
All peer worktrees were likewise fingerprinted without running commands inside
them: eight were clean, the pre-existing user-overlay worktree had three status
records, and the predecessor remained clean at `8c5d8747…`. Only the claimed
goal worktree is written or tested. A matching post-audit snapshot and the
exact clean final tip are reported in the final handoff; any independent peer
change would be disclosed rather than attributed to this goal.

## Supervision
- Goal: Extend the accepted Scout Knowledge Library investigation of agent self-evolution and autonomy by resolving the human-curated Xiaohongshu leads at body level wherever observationally accessible, while remaining source-agnostic: faithfully extract useful claims, trace them through primary sources, implementations, citations, alternatives, critiques, and contradictory evidence, assess novelty, value, credibility, tradeoffs, and limits, and integrate new conclusions into the existing ledgers, synthesis, and evidence report without trusting or silently dropping leads.
- Goal ID: "g_475c9885-50b2-4ed9-ba52-ddf355dd2ec7"
- Worker: "goal-498ea3b7616296fef384e226d44"
- Codex session: "01a05e2c-f1fe-7c30-9826-6eb13725ed74"
- Pane: "w1:p6F"
