<ai_context>
summary: "Evidence report for the bounded Scout deep dive on agent self-evolution and autonomy: 48 deduplicated human-collected XHS cards, existing library reconciliation, a source/claim map, cluster selection, two bounded local checks, and explicit access and replication limits."
triggers: ["self-evolution deep dive", "autonomy evidence report", "XHS self-evolution seeds", "agent evolution source map", "gated evolution research"]
last_updated: "2026-09-01"
source_basis: "Standing Scout checkpoint c917cad9f786a75dffc7b7b38a0f6dda2368822e; stable primary URLs and identifiers observed on 2026-09-01; goal-owned Harness-Bench and AgentStream scratch clones pinned in this report."
</ai_context>

# Agent Self-Evolution and Autonomy Deep Dive — Evidence Report

## What was missing and what changes

Scout had many strong notes about reflection, memory, skills, harnesses, and
evaluation, but no single map separated the mutable object, feedback signal,
proposal authority, admission authority, and deployment scope behind the label
"self-evolution." Historical notes could therefore place externally gated
harness optimization and recursive autonomy in the same conceptual bucket.

The new [canonical synthesis](../../knowledge/agent-self-evolution-and-autonomy.md)
adds that separation. This report preserves the evidence trail: which collected
posts motivated the questions, which existing notes were reused, which primary
sources were checked, what code was executed, and what remains unverified.

## Human-collected seed reconciliation came first

The standing Scout checkpoint
`c917cad9f786a75dffc7b7b38a0f6dda2368822e` was merged as committed evidence
before new external research. Its [seed ledger](../../knowledge/xhs-seed-ledger.md)
records a bounded collection observation on 2026-09-01 with 130 stable card IDs,
ID fingerprint `ea12a2380dee4c9b72fdf2c318d3dec87241747c48a44aae25b545a2b40deb12`,
and ID/title/author fingerprint
`e24ce2878aad734a94848d7a63f92a0cd4a9126681de03d49009f8bcb419c11c`.
The observed set was stable across two comparable passes. It is not the entire
declared collection: the last observed profile declaration was 995 notes plus
14 files, and the bounded tail remains unobserved.

This deep dive conservatively retained **48 distinct cards** whose visible
titles directly concern self-improvement mechanisms, evaluation, transfer,
recursive autonomy, or adjacent controls. Stable ID is the deduplication key.
They are confirmed collection cards, but their titles are metadata and
selection signals, not validation of their claims. Only the SkillRise card
`6a6ab006…c932` had a readable detail body in the standing checkpoint.

### RQ1 — What object changes, and does it persist?

| Stable ID | Visible title (abridged) | Access state | Question link |
|---|---|---|---|
| `6a4b745f…5691` | 让 skill 也学会自我优化的开源项目 | metadata only | skill update target |
| `6a4cdb26…7853` | 不是模型自己变强，而是 Harness 变强了 | metadata only | model/harness attribution |
| `6a4f9c5f…8ad6` | 硅谷新风向：Harness自进化 | metadata only | harness update target |
| `6a50bbbf…eb62` | Harness + Loop？自进化Agent最新综述 | metadata only | system decomposition |
| `6a5df00d…f7a6` | Agent自我进化只需要“一行 vibe” | metadata only | prompt-only boundary |
| `6a5eefed…562b` | 推理成本降低60%，递归Harness自改进来了 | metadata only | recursive harness claim |
| `6a601dd8…01b6` | 自进化Agent全景综述 | metadata only | taxonomy |
| `6a68001e…101a` | MetaEvolve推理模型自我进化越改越强 | metadata only | weight/meta-skill update |
| `6a6ab006…c932` | 任务Agent边做边记笔记，换新题照样强 | detail readable in standing checkpoint | cross-task skill persistence |
| `6a706936…3ed1` | Harness Handbook：进化智能体框架 | metadata only | harness anatomy |
| `6a7410a9…e5e4` | AgentEvolver：自我提问+自我导航+自我归因 | metadata only | data/exploration/credit |
| `6a753ceb…cae5` | Agent脚手架自进化，8B追平Opus | metadata only | scaffold vs model capability |
| `6a76d51c…54a9` | AHE：让Agent自己优化自身的Harness | metadata only | optimizer authority |
| `6a77217d…0fd6` | Self-Harness 解读 | metadata only | target-model proposal |
| `6a8193da…40d6` | 不改参数，靠技能手册自我进化 | metadata only | non-parametric evolution |
| `6a8bbb52…d5f1` | EnvHarness：让环境与Agent一起进化 | metadata only | environment update target |
| `6a8ffe56…f7ec` | 能够自我改进的 Harness | metadata only | harness persistence |
| `6a9083dc…ca5c` | code-as-Agent-Harness | metadata only | code as mutable policy |
| `6a955b35…afaf` | Agent Skills和知识库一起演化 | metadata only | multi-surface state |

### RQ2 — What evidence admits a change?

| Stable ID | Visible title (abridged) | Access state | Question link |
|---|---|---|---|
| `6a4e7165…3df3` | AgentGYM非理想化真实环境评测 | metadata only | environment validity |
| `6a50b737…db71` | 自进化评分标准—EvoRubric | metadata only | evaluator evolution |
| `6a582b3a…2462` | RLTF：只靠批评让首答变强 | metadata only | text feedback signal |
| `6a59fc8f…a52b` | SEED：让Agent学会任务复盘 | metadata only | outcome-to-skill credit |
| `6a5cccb6…6731` | Agent技能0.45→0.87：跨层错位检测 | metadata only | skill mechanism test |
| `6a5ce144…71a1` | 让AI自己学会总结经验 | metadata only | experience compilation |
| `6a5ea1bb…3000` | Agent 自我进化到底怎么评测 | metadata only | acceptance criteria |
| `6a68b3a8…aa49` | RL真的会创造新能力吗 | metadata only | capability novelty |
| `6a714858…cea5` | 流式实测，越强反而越没用 | metadata only | non-monotonic transfer |
| `6a7f5f7b…348b` | 自改进Agent有边界，理论说清了 | metadata only | formal limits |
| `6a81cce0…593f` | 一次 rollout 几十小时，Agent怎么学 | metadata only | evidence cost |
| `6a86a54a…3800` | Harness-Bench：我们可能一直在错 | metadata only | configuration attribution |
| `6a87e8d8…6091` | Agent自进化设闸门，修好才接受 | metadata only | admission gate |
| `6a8be16a…96a4` | 智能体对微小提示 nudge 高度敏感 | metadata only | robustness |

### RQ3 — When does adaptation become autonomy?

| Stable ID | Visible title (abridged) | Access state | Question link |
|---|---|---|---|
| `6a71f077…46bf` | 从 Self-Evolve 到 RSI | metadata only | recursive self-improvement boundary |
| `6a7151b9…03a4` | 为什么智能体需要本体论作为护栏 | metadata only | external constraints |
| `6a7d3636…b50a` | 记忆支撑长期、自我进化 Agent | metadata only | persistence prerequisite |
| `6a7e764f…2f2d` | 改变我对 RSI 认知的两小时 | metadata only | recursive-autonomy framing |
| `6a8577be…6efe` | 让 AI 智能体自己改自己 | metadata only | mutation authority |
| `6a8800f5…246f` | 世界模型＋Agent，不更新参数也能进化 | metadata only | environment/model boundary |
| `6a887216…577a` | Recursive Self-Improvement 整理 | metadata only | RSI taxonomy |
| `6a8edd8e…0689` | AI自我改进，先从局部飞轮开始 | metadata only | progressive authority |
| `6a91236f…2e2e` | AI变强之后，下一步是什么 | metadata only | terminal goal and governance |

### Adjacent retained controls

| Stable ID | Visible title (abridged) | Access state | Disposition |
|---|---|---|---|
| `6a5ef9ed…c122` | 后训练遗忘解释与控制 | metadata only | retained for weight-regression follow-up |
| `6a5fabd4…761f` | 三种知识如何驱动Agent | metadata only | retained for knowledge representation |
| `6a6b5102…2060` | 微软新型Agentic RL框架 | metadata only | retained; exact paper not established here |
| `6a7f1d67…60ea` | 偏好RL | metadata only | retained as reward-design context |
| `6a880abe…17a0` | deepseek harness重大更新 | metadata only | retained as implementation signal |
| `6a92bdf7…64d5` | RecHarness：自演化推荐系统 | metadata only | retained as vertical specialization |

### Deduplication and provenance decisions

- The 48 IDs above are distinct within the 130-card snapshot. Repeated titles,
  overview posts, and paper explainers remain separate human-interest seeds but
  are not counted as independent empirical confirmation.
- The retained XHS control-surface finding and the direct collection ledger can
  mention the same stable ID. That is one source with two provenance records,
  not two sources.
- SkillRise, coalition-aware skill admission, memory-stage governance, and task
  order were already deeply investigated by the standing goal. They are linked
  as prior evidence and not recreated as new findings.
- `qzzqzzb/Self-Harness` appeared in GitHub search but is not linked by the
  reviewed paper HTML. It was therefore not treated as attributable paper code.
- Xiaohongshu post bodies, likes, and author claims not recorded in the standing
  ledger were not inferred from titles.

## Existing Scout material reconciled

| Library artifact | Retained role | Reconciliation decision |
|---|---|---|
| [XHS control surface](../../knowledge/findings/2026-08-06-xhs-self-evolving-agent-control-surface.md) | early mechanism/evaluator signal | keep as source-specific history; canonical synthesis now supplies taxonomy |
| [Self-improving loops](../../knowledge/findings/2026-07-23-hn-self-improving-agent-loops.md) | cross-source skepticism, order, security, SkillRise | reuse its controlled results; no duplicate paper note |
| [Harness reflexivity scan](../../knowledge/findings/2026-06-23-hn-scan-113.md) | historical HN/arXiv convergence | qualify "self-modifying" with proposal/admission authority in the new synthesis |
| [Harness optimization evaluation](../../knowledge/findings/2026-08-08-arxiv-harness-optimization-evaluation.md) | protected-test and case-budget method | promote into the reusable workflow |
| [Skill admission](../../knowledge/findings/2026-08-08-skill-admission-before-activation.md) | quarantine and evaluator qualification | reuse; no duplicate skill taxonomy |
| [Memory evolution admission](../../knowledge/findings/2026-08-26-memory-evolution-heldout-admission.md) | held-out memory packages | reuse as A2 retained-adaptation evidence |
| [Agent self-correction trends](../../knowledge/agent-self-correction-trends-2026.md) | warning against undirected reflection | narrow to episodic correction unless output persists and transfers |
| [Standing topic map](../../knowledge/xhs-topic-map.md) | 15/15 self-evolution and memory clusters | keep living map intact; add bounded synthesis as integration-ready canonical note |

## Cluster selection rubric

Each axis is scored 0–3: **H** human-seed connection, **E** evidence quality and
contradiction value, **O** operational leverage, **R** bounded reproducibility,
and **S** safety/governance consequence. Engagement is not a quality score.

| Cluster | H | E | O | R | S | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| Harness evolution and gated admission | 3 | 3 | 3 | 3 | 3 | **15** | deep dive |
| Streaming transfer and interference | 3 | 3 | 3 | 3 | 3 | **15** | deep dive |
| Broad-goal autonomy and evaluator boundary | 3 | 3 | 3 | 2 | 3 | **14** | deep dive; paper evidence only |
| Memory/skill evolution | 3 | 3 | 3 | 3 | 3 | **15** | reuse standing deep dive; avoid duplication |
| Weight/environment co-evolution | 3 | 2 | 3 | 1 | 3 | **12** | synthesize mechanisms; defer costly reproduction |
| Domain-specific RecHarness / Agentic RL | 2 | 1 | 2 | 1 | 2 | **8** | retained follow-up, exact mapping incomplete |

## Source and claim map

Evidence labels: **Observed** means Scout directly inspected source or executed
the named check. **Reported** means the source authors claim the result.
**Analysis** is Scout's synthesis. Source quality uses `P1` for a primary paper
with detailed protocol, `P2` for a primary paper with narrower/abstract-level
review, `C1` for pinned attributable code, `L` for maintained local synthesis,
and `M` for metadata-only collection evidence.

| ID | Source, version, observation | Quality | Claim used | Evidence status / uncertainty |
|---|---|---|---|---|
| H1 | [XHS seed ledger](../../knowledge/xhs-seed-ledger.md), checkpoint `c917cad9f7`, observed 2026-09-01 | M | 130 bounded stable collection cards; 48 relevant IDs retained here | Observed by standing goal; collection tail remains unknown |
| L1 | [Self-improving loops](../../knowledge/findings/2026-07-23-hn-self-improving-agent-loops.md), through 2026-09-01 | L | task order, security drift, CASS, SkillRise | Mixed primary-source synthesis; reproduction limits preserved |
| L2 | [HarnessOpt-Bench note](../../knowledge/findings/2026-08-08-arxiv-harness-optimization-evaluation.md) | L/P1 | held-out nomination and case budgets | Paper-reported 111 runs |
| P1 | [Self-improvement survey `2607.13104v1`](https://arxiv.org/abs/2607.13104v1), API reviewed 2026-09-01 | P2 | configuration/update-target taxonomy | Abstract/system framework reviewed; not a benchmark |
| P2 | [Harness-Bench `2605.27922v1`](https://arxiv.org/html/2605.27922v1), HTML reviewed 2026-09-01 | P1 | configuration is the measurement unit; 106 tasks, 5,194 trajectories | Reported descriptive results, not causal mechanism ablation |
| C1 | [Harness-Bench `1025086`](https://github.com/Qihoo360/harness-bench/commit/1025086a446653702b80cfb48babbeec35db6b2c), inspected 2026-09-01 | C1 | 106 loadable task specs and working demo oracle path | Observed current code; revision postdates paper v1; no full model run |
| P3 | [Self-Harness `2606.09498v3`](https://arxiv.org/html/2606.09498v3), HTML reviewed 2026-09-01 | P1 | same-model proposal plus external held-out promotion improves nine pairs | Author-reported; reviewed paper exposes no attributable code link |
| P4 | [AgentStream `2608.00155v1`](https://arxiv.org/html/2608.00155v1), HTML reviewed 2026-09-01 | P1 | benefit is model/method/stream conditional; ACE mixed-stream reversal | Author-reported cross-factor experiment |
| C2 | [AgentStream/Sico `3b2e028`](https://github.com/microsoft/Sico/commit/3b2e0281faa89fd3c183b82b38ed009f25a13de6), inspected 2026-09-01 | C1 | five method runners share deterministic selection/order contract | Exact helper extraction passed; full package self-test lacked `pydantic`; no model run |
| P5 | [HarnessCompass `2608.01918v1`](https://arxiv.org/abs/2608.01918v1), API reviewed 2026-09-01 | P2 | constrained component-wise evolution reports 54%→66% Pass@1 | Abstract-reported, not independently reproduced |
| P6 | [Task-order re-evaluation `2608.18066v1`](https://arxiv.org/abs/2608.18066v1), standing full review | P1 | default-order gain reverses under shuffle | Author-reported, three-run setting |
| P7 | [SkillRise `2607.26784v1`](https://arxiv.org/abs/2607.26784v1), standing full review | P1 | later tasks supervise skill curation | Reported results; fixed-order code inspected |
| C3 | [SkillRise `2b38da3`](https://github.com/Within-yao/SkillRise/commit/2b38da3ad7b64414305d39609484803b07d3b9b0), standing inspection | C1 | K=3 groups and positional order; perturbation fixture prepared | Structure observed; GPU outcomes not reproduced |
| P8 | [Coalition-aware skill reliability `2608.22610v1`](https://arxiv.org/abs/2608.22610v1), standing full review | P1 | whole-bank gain does not attribute candidate utility | Reported 12 proposals / three seeds; code promised |
| P9 | [AgentEvolver `2511.10395v1`](https://arxiv.org/abs/2511.10395v1), API reviewed 2026-09-01 | P2 | self-questioning, navigation, attribution split learning functions | Preliminary abstract claims; code found but not reproduced |
| P10 | [MetaEvolve `2607.21971v1`](https://arxiv.org/abs/2607.21971v1), API reviewed 2026-09-01 | P2 | trained meta-skills report in/out-of-distribution gains | Abstract-reported; open-ended generality uncertain |
| P11 | [EnvHarness `2608.19880v1`](https://arxiv.org/abs/2608.19880v1), API/HTML reviewed 2026-09-01 | P2 | wrapper changes environment while retaining verifier | Abstract-reported; attributable code pinned but not executed |
| P12 | [HELIX `2608.13951v1`](https://arxiv.org/abs/2608.13951v1), API reviewed 2026-09-01 | P2 | typed interventions preserve co-evolution lineage | One reported code-repair round; no recursive longitudinal proof |
| P13 | [Aspire `2608.31111v1`](https://arxiv.org/html/2608.31111v1), HTML reviewed 2026-09-01 | P1 | vague-goal update completion rarely becomes retained gain | Reported sealed evaluation; freshly published v1, no local reproduction |
| P14 | [Financial-agent evolution audit `2608.17684v1`](https://arxiv.org/abs/2608.17684v1), standing review | P1 | utility, exposure, conditional compromise, and effects can diverge | One simulated bank/model; post-hoc interface sensitivity |
| P15 | [Agentic Harness Engineering `2604.25850v4`](https://arxiv.org/abs/2604.25850v4), API identified 2026-09-01 | P2 | observability-driven external harness evolution | Candidate linked from seed; not selected for full reproduction |
| P16 | [EvoRubric `2605.29847v1`](https://arxiv.org/abs/2605.29847v1), API identified 2026-09-01 | P2 | rubric itself can evolve | Important evaluator-recursion candidate; deferred full review |
| P17 | [RecHarness `2607.29241v1`](https://arxiv.org/abs/2607.29241v1), API identified 2026-09-01 | P2 | bandit-routed vertical harness evolution | Domain-specific; retained, not generalized |
| D1 | [HN harness article discussion](https://news.ycombinator.com/item?id=49164896), prior Scout note | community | practitioner framing shifts self-improvement to harness layers | Discovery/context only, not empirical confirmation |

### Contradictions resolved

1. **"The agent improved itself" vs external admission.** Self-Harness uses the
   same model as proposer, but fixed evaluators and held-out regression decide
   promotion. The result supports target-model proposals inside governance, not
   autonomous control-plane mutation.
2. **"Stronger model, more benefit" vs non-monotonic transfer.** AgentStream
   reports that weak models cannot extract signal, mid-capability models may
   benefit most, and stronger models reduce method spread. Model strength is a
   moderator, not a monotone multiplier.
3. **"Sequential gain proves learning" vs task-order curriculum.** The
   task-order study reverses a default-order gain under shuffle. Complete stream
   permutations are required before a transfer claim.
4. **"A successful update loop is improvement" vs Aspire.** Aspire agents
   routinely produce checkpoints and harnesses while protected results rarely
   beat base. Artifact completion is not a capability outcome.
5. **"One reliability score belongs to a skill" vs coalition and domain
   dependence.** CASS evidence supports binding admission to the tested bank
   composition and deployment domain.
6. **"More capability is safer if conditional compromise falls" vs exposure.**
   The financial audit shows stronger capability can encounter more hostile
   content and increase unauthorized effects despite a lower conditional rate.

## Focused local checks

All execution occurred in the goal-owned scratch root
`/app/worktrees/g-8c56b7d5-self-evolution-research`, never in the dirty source
checkout or another worker's worktree.

### Harness-Bench

Pinned source: `Qihoo360/harness-bench@1025086a446653702b80cfb48babbeec35db6b2c`.

Commands and observed outcomes:

```text
PYTHONPATH=src python3 -m harnessbench.cli tasks
  -> exit 0; task registry rendered

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 <inline integrity check>
  -> loaded_tasks=106; ID/prompt/oracle problems=[]

HARNESSBENCH_SKIP_PROCESS_GRADE=1 \
HARNESSBENCH_SKIP_ORACLE_QUALITY_LLM=1 \
PYTHONPATH=src python3 -m harnessbench.cli run-task \
  --task 001-file --harness demo-local --mode demo
  -> exit 0; adapter_ok=true; elapsed=0.506s; oracle linecount check=true;
     outcome_score=1.0
```

This validates task loading, one sandbox→adapter→oracle path, and the presence
of executable programmatic scoring. It does not validate any model/harness
ranking, process-judge score, or the paper's 5,194 trajectories.

### AgentStream

Pinned source: `microsoft/Sico@3b2e0281faa89fd3c183b82b38ed009f25a13de6`,
sparse path `labs/AgentStream`.

The repository's own `task_ordering.py` self-test did not start because the
goal environment lacks `pydantic`:

```text
ModuleNotFoundError: No module named 'pydantic'
```

No install was needed to answer the bounded source question. A standard-library
AST extraction executed the exact `_derive_seed` and
`_interleave_preserving_order` functions without importing the package. It
verified:

```text
deterministic=true
seed_changes_interleave=true
within_order_preserved=true
all_tasks_once=true
method_runners_checked=5
```

Static checks found the shared ordering call and all three scenario choices in
the ACE, Harness, ReasoningBank, AutoSkill, and A-Mem runners. This validates
the released ordering contract, not the reported model scores. Installing
dependencies would only unlock convenience tests; reproducing the paper would
also require provider credentials, six benchmark environments, many model
calls, and the original campaign budget. Those missing resources do not block
the supported code-structure finding.

## Repository validation

- `bun --cwd=projects/scout-knowledge-lib.app run check` exited 0: syntax
  bundling, TypeScript, and Prettier checks passed, followed by 78 tests with 0
  failures and 226 `expect()` calls.
- A goal-scoped resolver checked all 21 relative links in the two new documents
  plus the two links added to `INDEX.md`; all 23 resolve. A broader check of the
  index found 67 inherited missing targets among 797 relative links. None is on
  an added line, so this pre-existing index backlog is disclosed rather than
  folded into the focused research change.
- A provenance check resolved all 48 abbreviated card IDs to exactly one full
  stable ID in the seed ledger. It caught and corrected three display-suffix
  errors before finalization.
- `bun projects/scout-knowledge-lib.app/scripts/library-health-readonly.ts`
  reported 24 bounded facts and no fact about either new document. The facts
  are inherited future-dated files, oversized notes, and the existing unsourced
  index backlog; the packet is explicitly truncated and is not a claim of
  global library health.
- `git diff --cached --check` exited 0. A bounded accessibility check also
  received HTTP 200 from the five primary arXiv pages and two pinned GitHub
  commits used most heavily in the deep dive. Reachability does not validate
  an author's claim.

## Changes and integration scope

- Added [the canonical taxonomy and method note](../../knowledge/agent-self-evolution-and-autonomy.md).
- Added this evidence report rather than creating separate per-paper findings.
- Updated the library index with one canonical entry and this report.
- Merged the standing Scout checkpoint `c917cad9f7` into the goal branch so its
  seed ledger, topic map, and prior deep dives retain provenance and all relative
  links resolve.
- Did not edit the standing worker's worktree, dirty source checkout, account,
  external repositories, or any production system.

The bounded deliverable is designed for a later reconciliation merge into the
standing loop. Its novel scope is the cross-layer taxonomy, proposal/admission
authority distinction, harness and streaming comparison, Aspire autonomy
boundary, and reusable gated-release workflow. The standing loop remains the
owner of continued seed snapshots, SkillRise rollout experiments, and memory
governance follow-ups.

## Remaining limits and next experiments

- Direct XHS coverage is 130 bounded cards, not the declared 995-note collection
  or 14-file surface. No account mutation occurred.
- Most relevant collected posts are title/author metadata only; their bodies
  cannot support technical claims here.
- Self-Harness exposes no attributable repository link in the reviewed paper
  HTML. A GitHub name match was intentionally excluded as paper evidence.
- Large benchmark and training results remain author-reported. No credentials,
  accelerators, model checkpoints, or large datasets were provisioned for this
  goal.
- The highest-value next experiment is a matched stream factorial over model,
  method, task order, and seed with immutable intermediate artifacts. A smaller
  immediate experiment is evaluator qualification: generate adversarial harness
  candidates and measure false acceptance on sealed cases before permitting any
  multi-round evolution.

## Supervision
- Goal: Produce an evidence-backed Scout Knowledge Library deep dive on agent self-evolution and autonomy that synthesizes the human's relevant collected topics, documents, papers, projects, and ideas into a validated body of useful concepts, methods, implementation experience, tradeoffs, failure modes, and actionable research directions.
- Goal ID: "g_8c56b7d5-efb2-4ad5-b029-3d4752910e83"
- Worker: "goal-acc95da7db5accd83a5930497b6"
- Codex session: "01a05ce0-0d2b-7ab2-89ec-47b6d4f3bf62"
- Pane: "w1:p6D"
