<ai_context>
summary: "Living seed-first, multi-source topic map for Scout, including source-lane continuity, value scores, confidence, contradictions, access boundaries, and next explorations."
triggers: ["XHS topic map", "multi-source research loop", "GitHub arXiv Reddit continuity", "topic clusters", "XHS deep dive", "seed-first research"]
last_updated: "2026-09-01"
source_basis: "Direct bounded XHS collection reconciliations through 2026-09-01T11:30:14Z plus retained local evidence; topic-led GitHub, arXiv, Reddit, and Hugging Face checks; full-source reviews of arXiv 2608.22610v1, 2608.30177v1, 2604.16548v2, 2606.04315v1, and 2607.26784v1; pinned SkillRise and Mnemo repositories; and executable transport validation of sattyamjjain/mnemo revision 376ca28606c5b6287d9c8274482fa791d4dc8703."
</ai_context>

# Xiaohongshu Living Topic Map

This map starts from the [human-collection seed ledger](./xhs-seed-ledger.md).
The direct seed surface is readable but incomplete: the profile last declared
995 collected notes, while the latest bounded pass materialized 130 stable IDs.
All 24 earlier IDs remained present; 106 more became observable under improved
coverage and are not assumed newly collected. The unobserved tail and retained
local XHS records remain separate.

## Revisable value rubric

Once direct seeds are readable, **seed connection** is the first selector.
Until then it stays `U` (unknown), and the fallback score uses five 0–3 axes:

- **L — local XHS support:** specificity and number of deduplicated retained
  XHS sources.
- **C — cross-source support:** accessible independent evidence that can test,
  refine, or contradict the XHS signal.
- **I — operational impact:** consequence for building, evaluating, or
  governing agents.
- **G — resolvable gap:** important uncertainty that a bounded deep dive can
  reduce now.
- **F — freshness:** recency of the retained XHS or related evidence.

The score is `L+C+I+G+F` out of 15. Engagement affects discovery priority only;
it is not evidence quality.

## Active clusters

| Cluster | Seed connection | Score | Supporting sources | Current finding / uncertainty | Confidence | Next exploration |
|---|---|---:|---|---|---|---|
| **Self-evolution reliability and evaluation authority** | Confirmed: the original six plus newly materialized cards for SkillRise, harness evolution, evaluation, order, boundaries, and skill gates, including `6a4b745f…5691`, `6a50b737…db71`, `6a5ea1bb…3000`, `6a6ab006…c932`, `6a7f5f7b…348b`, `6a87e8d8…6091`, and `6a955b35…afaf` | **15** (`3+3+3+3+3`) | [Retained XHS packet](./findings/2026-08-06-xhs-self-evolving-agent-control-surface.md); [cross-source self-improvement note](./findings/2026-07-23-hn-self-improving-agent-loops.md); arXiv [`2608.22610v1`](https://arxiv.org/abs/2608.22610v1), [`2607.26784v1`](https://arxiv.org/abs/2607.26784v1); GitHub [SkillRise revision](https://github.com/Within-yao/SkillRise/commit/2b38da3ad7b64414305d39609484803b07d3b9b0) | The expanded direct surface makes self-evolution a co-leading cluster. SkillRise makes later-task outcomes supervise skill curation and reports cross-task scaling, but assumes family metadata and simple-to-complex order. Earlier evidence says order, coalition, security, and executor compatibility can reverse apparent gains. | High for the reviewed paper's reported protocol; moderate-high for the cross-source reliability pattern; moderate for generalization; low for untested open-ended streams. | Stress-test SkillRise's grouping/order assumption with repeated easy-to-hard, shuffled, reversed, and mis-grouped sequences while preserving evolved documents. |
| **Long-horizon persistence and stage-aware memory governance** | Confirmed: original three plus `6a5c3c50…fcb1`, `6a7d3636…b50a`, `6a8afea9…2a35`, `6a902f77…2296`, and other memory/continuity cards | **15** (`3+3+3+3+3`) | [Persistence-infrastructure packet](./findings/2026-07-22-xhs-agent-persistence-infrastructure.md); [long-horizon packet](./findings/2026-07-21-xhs-long-horizon-agents-survey.md); [ICML-memory packet](./findings/2026-07-29-xhs-icml2026-agent-memory-papers.md); arXiv [`2608.30177v1`](https://arxiv.org/abs/2608.30177v1), [`2604.16548v2`](https://arxiv.org/abs/2604.16548v2), and [`2606.04315v1`](https://arxiv.org/abs/2606.04315v1); Reddit [`t3_1v8a3sh`](https://www.reddit.com/r/mlops/comments/1v8a3sh/longterm_memory_in_llm_agents_is_an_attack/); GitHub [Mnemo revision](https://github.com/sattyamjjain/mnemo/commit/376ca28606c5b6287d9c8274482fa791d4dc8703) and [paper-index revision](https://github.com/NY1024/AgentSafety-Papers/commit/3a46dd37588e352a03e917da7a71b266f36e16bb) | The readable SkillRise seed bridges memory and self-evolution: a sequence-local skill document is the sole cross-task channel. MemGauge remains the freshest controlled stage-wise memory evidence. The Mnemo reproduction and candidate retain their distinct principal-binding role. | High for MemGauge and reproduced Mnemo behavior; moderate for lifecycle synthesis and generalization beyond evaluated settings. | Retain `2608.30177v1` as this cluster's anchor; inspect authenticated `org_id` binding after the higher-value new SkillRise order trigger. |
| **Build playbooks and implementation literacy** | Confirmed: `6a62d7a9…d139`, `6a73581f…d99e`, `6a762c6e…88d6` | **11** (`2+2+2+2+3`) | [Retained XHS build-playbook packet](./findings/2026-08-06-xhs-build-playbooks-outperform-intros.md) | The collection confirms direct interest in Unity CLI practice, issue triage, and large-project planning. Content quality and successful-use evidence remain unknown without detail reads. | Moderate for collection relevance; low-moderate for the format-performance claim. | Deep-read the project-planning seed and compare its operational steps with the retained playbook packet. |

## Source-lane continuity

This record supports the next seed-first cycle; it is a value decision log, not
a source-activity quota.

| Lane | Current relevance / expected value / freshness | Access and last useful evidence | Decision and revisit trigger |
|---|---|---|---|
| **GitHub** | **High relevance / high realized value / current; selected in cycle 7.** The readable SkillRise seed created an exact attributable-code question. | Exact repository search returned 78 results with `incomplete_results=false`; `Within-yao/SkillRise` was the relevant first result. The paper source directly links it. Public `main` resolved to `2b38da3ad7b64414305d39609484803b07d3b9b0`; its recursive tree was complete with 839 blobs and includes the three environment managers, solve/curate rollout loop, K=3 groups, and run scripts. There are no GitHub Actions runs or project-level tests; a commit message claims only ALFWorld validation plus one GRPO step. | Last useful evidence is attributable pinned source and repository structure, not independent reproduction. Revisit on a code/paper revision, released checkpoints/results, or a bounded order-perturbation fixture. Mnemo `org_id` remains queued. |
| **arXiv** | **High relevance / high realized value / fresh enough; selected in cycle 7.** The readable post named an exact mechanism and its claims required primary-source comparison. | Exact `all:SkillRise` Atom query returned one result at feed update `2026-09-01T11:30:39Z`: `2607.26784v1`. Full TeX source was reviewed. It reports later-task credit for curation and strong three-benchmark results, but assumes task-family metadata and ordered difficulty. `2608.30177v1` remains the fresher 15/15 anchor for stage-aware memory governance; SkillRise is the marginal self-evolution deep dive rather than a replacement. | Revisit `2607.26784` on version change or order/grouping stress evidence. Preserve `2608.30177v1` until its version, artifacts, or a stronger stage-wise study changes the memory rubric. |
| **Reddit** | **Medium relevance / low incremental value / unchanged; deferred in cycle 7 without quota work.** The new seed and primary sources resolve the current claim; no Reddit-specific question emerged. | Last useful evidence remains post RSS HTTP 200 at `2026-09-01T10:43:38Z`, stable `t3_1v8a3sh`, and six comments. JSON remains last observed HTTP 403. No request was issued merely to exercise the lane. | Revisit for a SkillRise/order discussion with distinct evidence, a new seed-linked thread, content delta, or access change. |

## Selected deep dive — coalition-conditioned skill reliability

The top-scoring cluster was selected because it connects the freshest retained
XHS control-surface signal to an accessible, testable reliability mechanism.
A full-source review of arXiv [`2608.22610v1`](https://arxiv.org/abs/2608.22610v1) adds one bounded finding to the
[maintained self-improvement note](./findings/2026-07-23-hn-self-improving-agent-loops.md):
skill reliability is a property of the skill, surrounding bank, and deployment
domain, not an intrinsic label on a skill.

Observed paper evidence includes 12 candidate proposals over three seeds, a
baseline outcome gate accepting 6 versus CASS accepting 1, and the baseline's
accepted additions measuring `-1.38` percentage points on average in a
bank-size-controlled comparison. A 20-query unlabeled target probe improved all
six tested banks after masking. The authors' strongest source-to-target reversal
has a negative target point estimate whose confidence interval includes zero,
and code is promised rather than currently available. Those limits keep this
as a promising mechanism-level result, not a universal rule.

## Second-cycle selection — stage-wise memory utility and risk

The second reconciliation kept direct seed membership unknown and preserved
the same 104-ID local fallback. Among current arXiv candidates, `2608.30177v1`
scored 15/15 because it has specific local XHS support, directly tests and
qualifies an existing high-impact Scout synthesis, resolves a current gap, and
was published on 2026-08-31. `2608.22339v1` and `2608.25553v3` each remained
valuable at 14/15 (`3+3+3+2+3`) but overlap more with already-deep-dived
admission and stale-memory work; `2608.17665v1` addresses a narrower
community-polarization branch.
The rubric therefore still selects `2608.30177v1` after reconciliation.

The full TeX source reports 11 models, 100 questions from each of LongMemEval
and LoCoMo, and matched clean/poisoned stage interventions. Writing has a
threshold-like transition: attack success stays generally below 10% through
0.3–0.5 admission coverage, then reaches 37–64% at full coverage. Management
changes attack success by as much as 62% while clean utility changes only 3–5%.
Across Mem0, Hindsight, LangMem, and A-MEM, top-K 1→7 raises clean utility from
24.6–29.3% to 52.7–64.2% and attack success from 4.7–12.2% to 36.1–53.7%.
Judge agreement with human majority labels is 91% on 400 trajectories, with
inter-annotator κ=0.78.

The maintained
[read-write attention synthesis](./the-read-write-attention-inversion.md) now
states the bounded conclusion: write governance remains necessary, but
retrieval exposure must be governed too. GitHub independently exposed the
paper through an AgentSafety-Papers index at pinned revision `3a46dd3`; neither
that index nor the paper source provides released MemGauge experiment code.
The GitHub record is discovery provenance, not a second experimental
confirmation. Reddit's public search RSS also surfaced metadata-only candidate
[`t3_1v8a3sh`](https://www.reddit.com/r/mlops/comments/1v8a3sh/longterm_memory_in_llm_agents_is_an_attack/),
whose title connects long-lived memory to an attack surface. The post-level
deep read was rate-limited, so its body supports no claim here.

## Third-cycle follow-up — lifecycle governance and recoverability

The third reconciliation completed at `2026-09-01T10:12:33Z`, before this
follow-up discovery. The direct collection stayed unobserved and the local
fallback stayed at 104 stable IDs / 125 URL occurrences / 24 files with
fingerprint `889d3247…d8fb`. The 15/15 memory cluster and its fresh
`2608.30177v1` anchor therefore still win the rubric after reconciliation; the
paper remains preserved and its full-source deep dive remains the current
stage-wise evidence. It was not replaced merely because a later related source
became readable.

Within that already-selected cluster, arXiv `2604.16548v2` wins the marginal
follow-up rubric at 14/15 (`3+3+3+3+2`). Reddit post `t3_1v8a3sh` is now readable
through post-level RSS and directly links the retained memory topic to this
survey. The paper reduces a current recovery gap, while its June v2 date is less
fresh than MemGauge. The Reddit post also cites `2606.04315v1`, but that paper
remains a queued candidate rather than evidence for this update.

The reviewed `2604.16548v2` TeX defines six phases—Write, Store, Retrieve,
Execute, Share & Propagate, and Forget & Rollback—and five Verifiable Memory
Governance predicates:

- **Write Authorization:** every committed entry has an authenticated source
  and passes an explicit write authorization check.
- **Provenance Visibility:** every entry has queryable, lineage-complete origin
  through summarization, merging, and distillation.
- **Principal-Scoped Retrieval:** retrieval returns only entries authorized for
  the requesting principal.
- **Rollbackability:** versioned snapshots and write logs can restore prior
  memory state.
- **Verified Forgetting:** post-deletion probing bounds re-exposure across raw
  logs, summaries, vector indexes, and propagated copies.

The paper orders the lineage-dependent primitives as verified forgetting
requiring rollback, rollback requiring provenance, and provenance requiring an
authenticated write origin; scoped retrieval is orthogonal but necessary for
confidentiality. Its appendix proposes a metric for each primitive. This is a
useful audit contract, not evidence that deployed systems satisfy it: the work
is a heterogeneous literature synthesis, its active limitations call the
lifecycle an organizational scaffold with blurred phase boundaries, and the
reviewed source reports no reproducible search query, screening counts, or
inclusion criteria. No end-to-end implementation evaluation is presented.

Reddit now contributes directly observed community framing rather than only
metadata. The post restates the survey, asks whether memory is managed as its
own risk asset, and interprets `2606.04315v1` as evidence for agent-controlled
write/retrieval. Comments raise tenant-scope leakage, lineage integrity, and
“delete-and-hope” rollback. They remain practitioner hypotheses, not
independent empirical confirmation: one commenter discloses working at Airia,
and another explicitly suspects machine-generated discussion.

## Fourth-cycle follow-up — active retrieval is not write governance

The fourth reconciliation completed at `2026-09-01T10:24:20Z`, before lane
reconsideration or paper selection. The direct collection remained unobserved;
the local fallback remained 104 stable IDs / 125 URL occurrences / 24 files
with fingerprint `889d3247…d8fb`. No local addition, change, or removal was
observed, while direct deltas remain unknown. The memory cluster therefore
remains 15/15 and `2608.30177v1` remains its freshest anchor.

GitHub and Reddit were explicitly deferred rather than exercised for quota.
Their cycle-3 observations were fresh, neither had a new candidate or access
change, and no revisit trigger fired. arXiv was selected to resolve the queued
interpretation of [`2606.04315v1`](https://arxiv.org/abs/2606.04315v1). Its
v1 source archive was directly observed over HTTP 200 as a 71,132-byte gzip
with SHA-256
`a6b3c07607c2851f53c97be7900bc8594138961415af820c02b51522571b962c`.

The paper evaluates eight memory systems plus DCI-Lite across five task
families and twelve reported columns. DCI-Lite retains raw trajectory text and
uses query-time `grep`/`read`; it has the best baseline generality rank, 3.67,
although no method wins every benchmark. The paper's AutoMEM harness—distinct
from the separate AutoMem paper `2607.01224` already in Scout—adds `rg`,
`read`, `dump`, and `index_query` over a prebuilt LightMem or PlugMem index.
Its plan-execute-judge loop reaches 67.3 on LoCoMo versus 45.0 for DCI-Lite and
61.5 for long context, and its inserted average rank is 3.10 versus 4.10 for
DCI-Lite. The full loop adds three to four language-model calls plus possible
retries; a single-pass ablation loses 3.8 points on LoCoMo while cutting
query-time tokens by 66–72% across three QA benchmarks.

The important boundary is between information retained and information never
stored. On a 60-question AMABench oracle-storage probe, answerability is 10%
for HippoRAG, 35% for SimpleMem, 83% for AMA-Agent, and 98% for PlugMem. An
iterative retriever can expose retained raw evidence that a passive router
missed, but cannot recover step or action predicates discarded by a frozen
build-time schema. Nor does the evaluated interface establish autonomous write
admission: the tools plan query-time reads over raw text or an already-built
index. The paper explicitly leaves access control, content filtering, and
audit logging out of scope.

This also bounds generality. On ALFWorld, long context reaches 46.7% success,
the best evaluated memory reaches 43.3%, a hand-built golden procedural memory
reaches 71.7%, and a GRPO-trained actor reaches 86.7%. Active retrieval helps
cross-scenario access, but non-parametric memory does not replace actor
capability or lifecycle governance. Reddit's wording is therefore retained as
an attributed interpretation and corrected, not promoted into a paper result.

## Fifth-cycle follow-up — implementation identity must follow the caller

The fifth reconciliation completed at `2026-09-01T10:32:54Z`, before any new
source request. The direct collection remained unobserved; the corrected local
inventory remained 104 stable IDs / 125 URL occurrences / 24 files with
fingerprint `889d3247…d8fb`. A preliminary 78-ID count was rejected because its
matcher omitted `/search_result/`; it is not a removal signal. The memory
cluster and fresh `2608.30177v1` anchor therefore remain selected at 15/15.

GitHub was selected because `2606.04315v1` claims an artifact repository without
giving a URL, which fired the recorded provenance trigger. Complete public
repository searches (`incomplete_results=false`) found two repositories for the
exact paper ID, five for the exact title, and one paper index for `"AutoMEM"
"Zhikai Chen"`. The attributable `CurryTang/CurryTang` profile links the paper
only to arXiv; its public repository list exposes no attributable paper code.
Two pinned paper lists also link only arXiv. Bounded Hugging Face API searches
returned HTTP 200 but no matching model, dataset, or Space. A bounded arXiv
exact-ID refresh returned the same two v1 entries, and Reddit post RSS returned
the same post and six comments. These checks leave the claimed artifacts
**unlocated**, not proven absent, and add no new paper or community claim.

[`sattyamjjain/mnemo`](https://github.com/sattyamjjain/mnemo/commit/376ca28606c5b6287d9c8274482fa791d4dc8703)
was the highest-value related implementation, but it is not author-attributable
paper code. At the pinned revision, its README describes `2606.04315` as an
agent-controlled write/revise/forget design. Its own synthetic crossover test
stores all 12 facts × 3 revisions plus 12 incidental details in the fixed arm,
while the agent-managed arm manually removes stale versions and omits incidental
details. Under a BM25/NoopEmbedding fixture, current-fact F1 is 0.500 versus
1.000 and incidental recall is 1.000 versus 0.000. Those are repository-designed
results about its constructed fixture, not a reproduction of the paper.

The source also exposes a distinct authority question. `call_tool` verifies a
per-request `CallerContext` and inserts it into request extensions, but the four
`mem_*` handlers do not consume that extension. Their inputs accept `agent_id`
and, for write/read/revise, `org_id`; the handlers copy those values into ordinary
remember, recall, and forget requests. Ordinary remember records the capability
principal only when invoked through its capability-authorized path; otherwise it
falls back to `created_by` or the record's `agent_id`. The source-level inference
is therefore that tool invocation permission is not bound to the identity used
for ownership, retrieval scope, deletion checks, or provenance in these four
handlers. At the end of cycle 5 this was source analysis only; cycle 6 below
then exercised it through the real MCP duplex service in a goal-owned clone.
Neither step is a live exploitation claim.

## Sixth-cycle follow-up — direct seeds and executable caller scope

The cycle's initial reconciliation at `2026-09-01T10:45:50Z` preserved an
unavailable direct boundary and an unchanged local 104-ID inventory. After the
human clarified WSL Chrome access, selection was reopened. A goal-owned observer
reached the existing Chrome session without executing inside the other worker's
container, opened an observational XHS tab, and established a bounded direct
collection baseline at `2026-09-01T11:15:53Z`: 995 notes declared, 24 stable
IDs materialized, no login wall, no malformed cards, and fingerprint
`158fa9850788df663eb60ac171461708b2dc4029318cb373e7eaa9494aa110eb`.
Only `6a7217af…00a2` overlaps the prior local inventory. The remaining 23 are
newly confirmed Scout seeds, not proven additions to the human collection;
there is no prior readable snapshot from which to infer added, changed, or
removed membership.

This reconciliation strengthens two clusters. Six observed cards directly
support self-evolution reliability, including a negative “stronger becomes less
useful” framing. Three cards connect cross-task memory, trustworthy progress,
and long-task continuity to stage-aware memory governance. The latter remains
15/15 and still outranks the 14/15 self-evolution cluster because it combines a
fresh controlled study with a current, executable authority gap. Accordingly,
`2608.30177v1` remains the anchor after direct reconciliation. Its existing
full-source deep dive is preserved; no repeat arXiv request was needed for a
quota.

The queued Mnemo test then separated four evidence layers:

1. **Pinned source observation:** public `main` still resolved to
   `376ca28606c5b6287d9c8274482fa791d4dc8703` at
   `2026-09-01T11:07:14Z`. Complete issue search returned zero matching issues
   and `incomplete_results=false`. At that source, `server.rs` handlers
   `mem_write`, `mem_read`, `mem_revise`, and `mem_forget` accept input
   `agent_id` without `Extension<CallerContext>`.
2. **Repository baseline:** in a goal-owned Docker execution space, Rust stable
   resolved to 1.98.0. Pinned `mcp_test` passed 11/11 and
   `per_request_identity` passed 14/14. Those suites establish the surrounding
   dispatch and flat-store contracts, not the missing four-wrapper property.
3. **Goal-owned wire-path reproduction:** one strengthened test issued a valid
   capability for `alice` over the real MCP duplex service. Alice wrote as Bob;
   the stored owner and provenance principal were Bob with no capability ID.
   Alice then read a separately preseeded Bob `agent-managed` record, revised
   it, and forgot the revision. The diagnostic passed before any fix.
4. **Isolated candidate:** commit
   `c82e711e8a2bb386001e98c3437da44c32b62428` adds the resolved caller extension
   to all four wrappers, treats optional `agent_id` as a matching assertion,
   rejects conflicts, and always sends the caller principal to the engine. Its
   regression proves all four Alice→Bob requests fail, Bob's record remains,
   and an Alice write is owned and provenanced as Alice. `cargo fmt --check`,
   the focused 11- and 14-test suites, and the full 89-test `mnemo-mcp` package
   pass on this candidate.

The candidate is locally committed and reviewable, but it has not been pushed,
reviewed upstream, deployed, or exercised over a live HTTP server. It also does
not authenticate `org_id`: the current `CallerContext` carries a principal and
roles, not an organization. Write/read/revise still accept that field, so
tenant binding remains a separate open authority question rather than an
implied property of the fix.

## Seventh-cycle follow-up — later tasks judge the skill rewrite

Cycle 7 began with a comparable direct observation, not discovery. The bounded
surface expanded from 24 to 130 stable IDs, with all prior IDs present, exact
title/author change `[]`, and 106 newly materialized IDs. Improved rendering
coverage prevents treating those 106 as newly collected. The previously
unavailable `6a6ab006…c932` detail became readable and named SkillRise, firing
its recorded revisit trigger.

The post's claims were checked against both selected lanes. The arXiv exact-name
query returned only `2607.26784v1`, whose full source was reviewed. It organizes
related tasks into ordered sequences and makes one policy alternate solve and
curate phases. Current task outcome supervises solving; discounted later-task
outcomes supervise curation. With Qwen3-4B across 128 held-out instances in each
of ALFWorld, WebShop, and ScienceWorld, reported Pass@1 is 85.9%, 84.4%, and
54.6%, exceeding the strongest listed baseline by 2.3, 7.1, and 8.5 points.
ALFWorld improves from 83.6% at two related tasks to 87.5% at six with one
attempt per task. The authors' same-GPU comparison reports one sixth of
RetroAgent's runtime and about one quarter of SkillRL's.

GitHub search was complete (`incomplete_results=false`) and the paper directly
links `Within-yao/SkillRise`. Public `main` resolved to
`2b38da3ad7b64414305d39609484803b07d3b9b0`; the non-truncated recursive tree
contains 839 blobs, including the solve/curate loop, three environment managers,
K=3 groups, and run scripts. The repository has no GitHub Actions runs or
project-level suite. One commit message reports ALFWorld validation plus one
GRPO step; this is maintainer provenance, not independent Scout execution.

The deep dive strengthens the external-evaluator thesis but also exposes its
next test. Task families come from environment metadata and instances are
ordered simple-to-complex. That can be a hidden curriculum, while the earlier
`2608.18066v1` result shows task order can reverse textual-memory gains. The
paper tests only models up to 4B, three text environments, and verifiable
rewards; it does not test shuffled, reversed, or mis-grouped sequences, hostile
content, cross-session governance, or multi-principal skill ownership.
`2608.30177v1` therefore remains the memory cluster's fresher controlled anchor;
SkillRise becomes the co-leading self-evolution cluster's marginal deep dive.

## Connections and tension

- **Self-evolution ↔ governed memory:** a growing skill or memory bank is a
  write-admission system. Coalition pollution is another form of ungated
  accumulation; target-conditioned masking is a subtraction step.
- **Build playbooks ↔ evaluation authority:** practical guides can spread a
  pattern before its reliability conditions are known. Visible engagement
  should nominate an audit, not substitute for one.
- **Contradiction to simple accumulation:** the retained XHS memory-evolution
  signal treats adaptive banks as progress; `2608.22610` shows that more
  admitted skills can reduce average performance. The claims can coexist only
  if admission and retirement evidence are explicit.
- **Correction to exclusive write-side governance:** `2608.30177` shows that
  management can locally decouple risk, while retrieval exposure couples clean
  utility and attack success. The earlier write-path thesis survives only as a
  claim about neglected controls, not proof that read-side choices are solved.
- **Correction to autonomous write-control framing:** `2606.04315` supports
  question-conditioned, iterative retrieval and delayed schema commitment.
  Its evaluated tools do not authorize new memory writes, and the paper leaves
  access control, filtering, and audit logging out of scope. Active retrieval
  must therefore sit behind the survey's principal, provenance, and
  authorization boundaries rather than substitute for them.
- **Implementation authority gap:** Mnemo turns the overstated framing into
  write/revise/forget tools, then accepts identity scope from tool input even
  though dispatch has already resolved the authenticated caller. The
  Alice→Bob reproduction proves this at the four-wrapper wire path; the isolated
  caller-binding candidate shows the smallest validated repair.
- **Bounded evidence:** direct collection membership is confirmed for 130
  materialized cards out of the last declared 995 notes. The 106-ID expansion
  is improved coverage, not proof of new collection. Seed `6a6ab006…c932` is
  now readable, but most post bodies, the collection tail, and complete removal
  state remain unknown. Reddit JSON previously
  returned HTTP 403, while post RSS returns HTTP 200 with the post and six
  comments; that is attributable community evidence, not paper validation.

## Cycle log

| Cycle | Seed reconciliation | Related discovery | Deep dive | Map decision | Next |
|---|---|---|---|---|---|
| 2026-09-01 | Direct set unobserved; no additions, changes, or removals inferred. Local fallback: 104 stable IDs / 125 occurrences, deduplicated by ID. | arXiv query for self-evolving/self-improving agents found `2608.22610v1`; full source reviewed. | Coalition pollution and cross-domain utility reversal. | Added three active clusters; selected reliability/authority at 13/15. | Restore observational collection reachability, then reconcile and prioritize any collected evaluator or skill-bank post; independently test the paper when code appears. |
| 2026-09-01 cycle 2 | Reconciled first at 10:00:06Z: direct set still unobserved; local fallback unchanged at 104 stable IDs / 125 occurrences and fingerprint `889d3247…d8fb`. | After reconciliation, arXiv HTML search returned `2608.30177` first; the specific API record and full source were readable. GitHub's complete nine-result `MemGauge` query found a pinned paper index but no attributable experiment repository. Reddit JSON returned HTTP 403; global search RSS returned metadata for `t3_1v8a3sh`, then its deep read returned HTTP 429. | Stage-wise utility-risk profiles across controlled interventions and four real systems. | Memory governance rises to 15/15 and qualifies the read-write synthesis; Reddit metadata remains a candidate, not claim support. | Reconcile XHS first again; look for attributable `2608.30177` code, then reproduce stage profiles under additional attacks. Revisit the Reddit candidate after the rate-limit boundary changes. |
| 2026-09-01 cycle 3 | Reconciled first at 10:12:33Z: direct set still unobserved; local fallback again unchanged at 104 IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb`. | Bounded GitHub repository searches were complete; the arXiv exact-ID feed returned `2604.16548v2`, `2606.04315v1`, and preserved `2608.30177v1`; Reddit post RSS returned `t3_1v8a3sh` plus six comments. | `2604.16548v2` lifecycle framework and five proposed governance predicates; Reddit claims kept attributable and non-empirical. | The 15/15 cluster and MemGauge anchor remain selected. The 14/15 marginal follow-up adds recoverability and lineage requirements without counting paper indexes or comments as confirmation. | Reconcile XHS first; deep-read `2606.04315v1` and test whether its active-control result entails safe write authorization, provenance, and principal scope. |
| 2026-09-01 cycle 4 | Reconciled first at 10:24:20Z: direct set still unobserved; local fallback unchanged at 104 IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb`. | GitHub deferred because complete searches were fresh; Reddit deferred because the thread and comments were just reviewed; arXiv selected and `2606.04315v1` full source reviewed. | Cross-scenario memory generality, build-time schema loss, iterative retrieval, AutoMEM cost/accuracy, and the dynamic-task ceiling. | Preserve the 15/15 cluster and `2608.30177v1` anchor. Correct Reddit's write-control interpretation: the paper supports active query-time reads, not governed memory admission. | Reconcile XHS first; seek attributable `2606.04315` artifacts or test principal-scoped iterative retrieval. Revisit GitHub or Reddit only when their recorded triggers fire. |
| 2026-09-01 cycle 5 | Reconciled first at 10:32:54Z: direct set still unobserved; corrected fallback unchanged at 104 IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb`; rejected an incomplete matcher rather than recording a false delta. | GitHub selected on the paper-artifact trigger; Hugging Face checked as related discovery; bounded arXiv exact-ID and Reddit post-RSS reads returned HTTP 200 with the same versioned papers, post, and six comments. | Pinned Mnemo source audit: repository-specific synthetic crossover, paper misattribution, and an inferred caller-identity binding gap in the four `mem_*` handlers. | Preserve `2608.30177v1` as the 15/15 anchor. No new arXiv or Reddit candidate displaced it. Classify Mnemo as related implementation evidence, not paper artifact, reproduction, or live vulnerability proof. | Reconcile XHS first; exercise the identity boundary through Mnemo's authenticated transport or inspect a fix binding `mem_*` operations to `CallerContext`. Revisit paper artifacts when an attributable URL appears. |
| 2026-09-01 cycle 6 | Initial 10:45:50Z fallback was superseded by direct reconciliation at 11:15:53Z: 995 notes declared, 24 IDs materialized, one local overlap, 23 newly confirmed Scout seeds, and no prior-readable delta inference. | GitHub selected and refreshed at pinned Mnemo head; arXiv anchor retained from its minutes-old exact-ID refresh; Reddit deferred without quota work. | Real MCP Alice→Bob write/read/revise/forget reproduction, followed by a locally committed caller-binding fix and full package validation. | Direct memory/continuity seeds keep `2608.30177v1` and stage-aware governance at 15/15; self-evolution rises to 14/15. Separate source observation, executable reproduction, candidate behavior, and absent deployment proof. | Begin cycle 7 with a comparable direct collection snapshot; deep-read `6a6ab006…c932` if its `/404` boundary changes, otherwise explore authenticated organization scope in memory tooling. |
| 2026-09-01 cycle 7 | Reconciled first at 11:29:49Z–11:30:14Z: 130 IDs, fingerprint `ea12a238…b12`; all prior 24 present, 106 newly materialized, title/author changes `[]`, and `6a6ab006…c932` now readable. | GitHub and arXiv selected for exact SkillRise provenance; Reddit deferred without quota work. GitHub search was complete and the paper-linked repository pinned; arXiv exact-name search returned one v1 paper. | Full-source review of `2607.26784v1` and pinned code-structure audit at `2b38da3…9b0`. | Self-evolution joins memory governance at 15/15. Retain `2608.30177v1` as memory's fresher stage-wise anchor; admit SkillRise as external later-task curation evidence with an order/grouping caveat. | Begin the next seed-first reconciliation, then audit SkillRise under shuffled, reversed, and mis-grouped task sequences or inspect a bounded fixture if full GPU reproduction remains disproportionate. |
