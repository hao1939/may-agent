<ai_context>
summary: "Evidence report for a source-agnostic deep investigation of agent self-evolution and autonomy. It reconciles 906 observed Xiaohongshu cards with primary papers, repositories, and prior Scout work; records all 969 leads explicitly; compares mechanisms and alternatives; and separates source claims from direct inspection and analysis."
triggers: ["self-evolution deep dive", "autonomy evidence report", "agent evolution lead ledger", "XHS collection resolution", "skill and harness evolution evidence"]
last_updated: "2026-09-01"
source_basis: "Goal-owned lead ledgers, 29 locally extracted full-text papers, pinned repository inspections, existing Scout notes, and bounded standard-library or no-credential code checks. External performance results are attributed, not presented as Scout reproductions."
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

The result is deliberately skeptical. “Self-evolving” is retained only when a
durable agent configuration changes. Search-time program evolution, within-
rollout state, adaptive routing, skill-library operations, world-model
adaptation, and policy learning remain valuable, but are not collapsed into one
claim of recursive autonomy.

## Research frontier and lead accounting

The [unified lead ledger](./agent-self-evolution-lead-ledger-2026-09-01.tsv)
contains 969 unique rows:

- 906 Xiaohongshu collection cards with stable IDs;
- 36 paper, survey, primary-metadata, or benchmark records;
- 19 code-bearing, code-metadata, or paper-plus-code records where implementation evidence changes
  the judgment; and
- 8 existing Scout notes and reports, each reconciled rather than silently reused.

The companion [Xiaohongshu resolution ledger](./agent-self-evolution-xhs-ledger-2026-09-01.tsv)
preserves the complete observed surface rather than only retained cards. Its
bounded snapshot contains 906 observed of 995 declared collection notes, with
89 unobserved and stable-ID fingerprint
`a87a3648fcfc53d95ea3895a0fe0effbcf199a6e14aa72f7c84acc2e21b33c5c`.
Classification is 162 core, 296 adjacent, and 448 outside this topic.

At this revision the goal-owned browser was logged out. The QR was refreshed
for the human, but no authenticated body access had yet been observed. All 906
cards are therefore labeled `metadata-only`: titles and authors are discovery
evidence, never proof of the technical claim. The 89-card tail and all bodies
remain explicit access boundaries. No card is guessed from neighboring text,
and no account or content action was performed.

The unified ledger's dispositions are intentionally not all “researched”:

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
| [LoopX](https://github.com/huangruiteng/loopx/tree/ae4887d707e69c19e712c379c4a1ef98b159ae64) | pinned code, protocols, public metadata, deterministic smokes, KNN evaluator | typed evidence, authority, quota, and settlement can govern heterogeneous harnesses | young v0.x project; public checks prove plumbing, not autonomous improvement |
| [Arbor `2606.11926`](https://arxiv.org/abs/2606.11926) | paper and pinned code | persistent Idea Tree, isolated executors, retry artifacts, and held-out promotion support metric-driven research | author-reported, expensive, fixed-evaluator tasks; LoopX adaptation not validated by Arbor results |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent/tree/562ee8ab76a703b7f524172cae0b1d52f9f94bd3) | pinned code and docs | integrated runtime now has durable Kanban, goal loops, memory, skills, claims, worktrees, retry, and review | Kanban is single-host; background learning prompt risks overlearning |
| [OpenClaw](https://github.com/openclaw/openclaw/tree/8a718610bd26ffcffeb04e19641c80e6693731a1) | pinned code and docs | provenance-tiered memory and proposal/hash/rollback skill governance create stronger self-learning boundaries | design rationale is not outcome proof; autonomous Skill Workshop defaults to auto |

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

### Evaluator authority

Fixed hidden or executable evaluators provide the clearest admission evidence.
Generated rubrics can supply dense feedback and discover missing criteria, but
the proposer and judge may share blind spots. A different model is diverse, not
independent. Genuine evaluator co-evolution without an immutable anchor remains
mostly a proposal; CORAL explicitly leaves it to future work. No reviewed
evidence justifies giving a co-evolving judge sole promotion authority.

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

### Cross-harness governance: LoopX versus Arbor, Hermes, and OpenClaw

The focused [LoopX investigation](../../knowledge/findings/2026-09-03-github-loopx-governed-cross-harness-control-plane.md)
resolves a new category boundary. LoopX is primarily a control plane above
agent harnesses: it turns goals, todos, evidence, gates, authority, quotas,
claims, and terminal settlement into durable shared state. Hermes Agent and
OpenClaw are primarily integrated assistant runtimes that now also contain
durable work and learning mechanisms.

LoopX's auto-research workflow explicitly adapts Arbor. Arbor's coordinator
owns a hypothesis tree and dispatches isolated executors; LoopX distributes
role-specific frontiers over shared typed state without requiring a durable
leader identity. The hypothesis–experiment–held-out loop is therefore inherited.
The distinct LoopX claim is that revision fences, actor scope, evidence lineage,
and idempotent settlement let heterogeneous harnesses collaborate safely.

That distinction matters, but its outcome value is not yet established. Four
deterministic LoopX research smokes and the released KNN baseline passed in a
goal-owned worktree, proving state/evaluator plumbing. They did not run an
autonomous multi-agent improvement campaign or compare the decentralized
topology with Arbor under equal models and budgets.

Hermes's current durable Kanban substantially narrows the task-queue novelty:
it has claims, dependencies, OS-process workers, worktrees, retries, heartbeats,
review, comments, and crash reclamation. OpenClaw separately supplies session
goals, Task Flow, detached work, cron, standing orders, and strong provenance-
aware memory. LoopX remains clearest when multiple runtimes need one typed
evidence and authority contract. It is likely overhead when one runtime or an
existing supervisor already owns canonical durable state.

The self-learning comparison exposes two policy failures. Hermes's post-turn
review pushes most sessions toward a skill mutation, risking overlearning and
cost. OpenClaw's Skill Workshop has stronger abstention, hash binding, scanning,
and rollback, but defaults autonomous mode to `auto`. For Scout, the safer
combination is proposal-first learning, protected held-out admission, structural
provenance/taint barriers, and explicit separation of learned content from
authority to act.

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
7. **LoopX's value is governance, not autonomous intelligence.** Typed evidence,
   scoped authority, quotas, frontier projections, and idempotent settlement are
   worth borrowing; duplicating an existing durable supervisor is not.

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

## Focused direct checks already completed

All execution occurred in goal-owned scratch space, never the dirty source
checkout or another worker's worktree.

### LoopX auto-research

Pinned source: `huangruiteng/loopx@ae4887d707e69c19e712c379c4a1ef98b159ae64`.

Four deterministic examples passed: KNN preset materialization, KNN evidence
normalization, decentralized role-frontier projection, and the minimal
auto-research kernel. The materialized KNN evaluator then produced development
`0.958163x` and held-out `1.030135x`, with exact-correctness checks passing.

The first evaluator call failed because `eval.sh` assumes its materialized
workspace is the current directory; the same command succeeded there. This
proves the released state/evidence/evaluator path, not autonomous multi-agent
improvement, comparative superiority to Arbor, or the public showcase claims.

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

## Repository validation

- `bun --cwd=projects/scout-knowledge-lib.app run check` exited 0. It bundled
  the application and workflows, passed TypeScript and Prettier checks, and ran
  78 tests with 0 failures and 226 assertions.
- A standard-library TSV validator read all records at their declared widths:
  906 unique XHS IDs across 9 columns and 969 unique unified lead IDs across 14
  columns. Every unified row has a research question.
- A scoped resolver checked 9 relative links across the canonical note, this
  report, the LoopX finding, and its index target; 0 were missing. A broader
  INDEX scan still exposes inherited missing links outside this goal's diff.
- `git diff --check` exited 0.
- `bun projects/scout-knowledge-lib.app/scripts/library-health-readonly.ts`
  completed and returned a bounded, truncated packet of 24 inherited facts:
  future-dated files, oversized notes, and the existing unsourced index backlog.
  None names a file added or rewritten by this goal, so the packet is disclosed
  rather than misrepresented as global library health.

## Remaining limits

- Xiaohongshu body access and the final 89 declared cards remain login-bound at
  this revision. The open browser lets the human authenticate observational
  access; no account mutation is authorized.
- Many 2026 papers are recent preprints. Results are author-reported unless a
  direct check above says otherwise.
- No deep-learning campaign was reproduced locally. The environment lacks the
  required model weights, provider calls, benchmark services, and large GPU
  budgets; those are capability boundaries for reproduction, not blockers to
  source analysis.
- The 969-row ledger is complete for the bounded encountered frontier, not for
  every paper that could exist. Each unresolved or deferred row includes the
  evidence that would reopen it.
- Existing Scout notes were reused for task-order, SkillRise, memory governance,
  and harness evidence. This focused report does not take ownership of the
  standing Scout loop or its future collection snapshots.

## Integration scope

This revision adds the unified and XHS ledgers, replaces the outdated canonical
note and report, and updates the knowledge index. It does not push, merge,
deploy, modify an account, or edit the dirty source checkout. Repository
validation is recorded above; the exact diff remains reviewable on the local
goal branch.

## Supervision

- Goal: Produce a lead-complete, evidence-backed Scout Knowledge Library deep investigation of agent self-evolution and autonomy: treat every potentially useful lead from the human's collections, existing Scout material, primary sources, repositories, citations, discussions, and discovered related work as a research thread; trace, challenge, and compare it; assess its novelty, value, credibility, tradeoffs, and limits; and synthesize careful, actionable conclusions without silently dropping leads or trusting claims at face value.
- Goal ID: "g_8c56b7d5-efb2-4ad5-b029-3d4752910e83"
- Worker: "goal-acc95da7db5accd83a5930497b6"
- Codex session: "01a05ce0-0d2b-7ab2-89ec-47b6d4f3bf62"
- Pane: "w1:p6D"
