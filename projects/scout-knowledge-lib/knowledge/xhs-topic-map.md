<ai_context>
summary: "Living seed-first, multi-source topic map for Scout, including source-lane continuity, value scores, confidence, contradictions, access boundaries, and next explorations."
triggers: ["XHS topic map", "multi-source research loop", "GitHub arXiv Reddit continuity", "topic clusters", "XHS deep dive", "seed-first research"]
last_updated: "2026-09-01"
source_basis: "XHS retained local evidence through 2026-08-19; seed reconciliations at 2026-09-01T09:53:22Z, 2026-09-01T10:00:06Z, and 2026-09-01T10:12:33Z; topic-led GitHub, arXiv, and Reddit checks; and full-source reviews of arXiv 2608.22610v1, 2608.30177v1, and 2604.16548v2 on 2026-09-01."
</ai_context>

# Xiaohongshu Living Topic Map

This map starts from the [human-collection seed ledger](./xhs-seed-ledger.md).
The direct seed set is currently unobserved, so current cycles use retained
local XHS evidence as an explicit fallback. No retained URL is called a human
seed unless a readable collection snapshot confirms it.

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
| **Self-evolution reliability and evaluation authority** | U | **13** (`3+3+3+2+2`) | [Retained XHS packet](./findings/2026-08-06-xhs-self-evolving-agent-control-surface.md); [cross-source self-improvement note](./findings/2026-07-23-hn-self-improving-agent-loops.md); arXiv [`2608.22610v1`](https://arxiv.org/abs/2608.22610v1) | XHS metadata says attention is moving from generic self-evolution toward evaluator independence, learning state, and human interference. Cross-source evidence adds task-order, security, executor-compatibility, and coalition confounders. Unknown: whether any of these posts are human-collected or whether full XHS content supports more than their visible metadata. | Moderate-high for the cross-source reliability pattern; low for unseen XHS post contents. | Reproduce or independently audit `2608.22610` once code is released; on seed access, deep-read any collected evaluator/skill-reliability post first. |
| **Long-horizon persistence and stage-aware memory governance** | U | **15** (`3+3+3+3+3`) | [Persistence-infrastructure packet](./findings/2026-07-22-xhs-agent-persistence-infrastructure.md); [long-horizon packet](./findings/2026-07-21-xhs-long-horizon-agents-survey.md); [ICML-memory packet](./findings/2026-07-29-xhs-icml2026-agent-memory-papers.md); arXiv [`2608.30177v1`](https://arxiv.org/abs/2608.30177v1) and [`2604.16548v2`](https://arxiv.org/abs/2604.16548v2); Reddit [`t3_1v8a3sh`](https://www.reddit.com/r/mlops/comments/1v8a3sh/longterm_memory_in_llm_agents_is_an_attack/); GitHub [paper-index revision](https://github.com/NY1024/AgentSafety-Papers/commit/3a46dd37588e352a03e917da7a71b266f36e16bb) | Persistent agents need stage-aware utility/risk measurement plus lifecycle governance. The survey makes rollback and verified forgetting depend on authenticated writes, lineage, and versioned state; principal-scoped retrieval remains a separate confidentiality gate. Direct collection relevance is unknown, MemGauge's four-system results are diagnostic, and the survey proposes rather than validates its governance predicates. | High for MemGauge's evaluated settings; moderate for the lifecycle synthesis; low for unseen XHS post contents and unbenchmarked end-to-end governance. | Deep-read `2606.04315v1` to test the Reddit post's “agent-controlled memory generalizes best” interpretation, then map active write/retrieve control to the survey's authorization and provenance prerequisites. Reconcile XHS first. |
| **Build playbooks and implementation literacy** | U | **10** (`2+2+2+2+2`) | [Retained XHS build-playbook packet](./findings/2026-08-06-xhs-build-playbooks-outperform-intros.md) | In one search packet, process maps and source-code notes had more visible engagement than generic definitions or launch framing. Unknown: collection relevance, content quality, and whether the ranking persists across queries or time. | Low-moderate; title/author/like snapshots only. | On access, compare collected build artifacts by format and inspect whether saves/comments reflect successful use rather than curiosity. |

## Source-lane continuity

This record supports the next seed-first cycle; it is a value decision log, not
a source-activity quota.

| Lane | Current relevance / expected value / freshness | Access and last useful evidence | Decision and revisit trigger |
|---|---|---|---|
| **GitHub** | High relevance to the selected memory cluster because released code could make MemGauge reproducible; high expected value if attributable code appears; search observed 2026-09-01. | Public repository Search API returned HTTP 200. Complete searches (`incomplete_results=false`) returned nine repositories for `"MemGauge"`, three for the exact `2604.16548v2` title, and four for `"Verifiable Memory Governance"`. They exposed paper indexes and thematically related repositories, but no attributable implementation of either paper. GitHub contents were not counted as paper confirmation. | **Selected and checked; no library promotion.** Revisit when either paper links code, a search result changes materially, or an attributable repository revision appears. Pin a commit before using implementation contents as evidence. |
| **arXiv** | Highest relevance and expected value for the selected cluster; `2608.30177v1` is fresh from 2026-08-31, while the selected governance follow-up is `2604.16548v2`, updated 2026-06-11. | Exact-ID Atom request returned HTTP 200 and one current entry each for `2604.16548v2`, `2606.04315v1`, and preserved `2608.30177v1`. Full TeX reviews now cover `2608.30177v1` and `2604.16548v2`; no paper-index record is treated as duplicate evidence. | **Selected and deep-read.** Keep `2608.30177v1` as the 15/15 cluster anchor. Next deep-read `2606.04315v1` after another XHS reconciliation to test the active-control claim and its governance assumptions. |
| **Reddit** | Directly relevant because the selected thread links the memory-risk cluster to both follow-up papers; medium information value as practitioner framing; thread published 2026-07-27. | Post-level RSS now returns HTTP 200 for stable post `t3_1v8a3sh` and six `t1_...` comments. The post cites both papers; comments discuss tenant scope, provenance, and rollback. One commenter discloses an Airia affiliation and another suspects generated discussion, so these remain attributed anecdotes rather than empirical proof. Earlier JSON requests returned HTTP 403 and remain a narrower endpoint boundary, not a claim that all Reddit is unavailable. | **Selected and examined; claims admitted only as community evidence.** Revisit when a new high-signal thread connects to a reconciled seed, a cited paper requires interpretation, or post-RSS access changes; do not retry blocked JSON merely to satisfy a lane count. |

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
- **Blocked evidence:** direct collection membership, current engagement, full
  XHS post text, and collection removals remain unknown while the browser
  endpoint is outside this worker's reachable network namespace. Reddit's JSON
  endpoints previously returned HTTP 403, but post-level RSS now returns HTTP
  200 with the post and six comments. The body is usable as attributable
  community evidence, not as validation of its cited papers or production
  prevalence claims.

## Cycle log

| Cycle | Seed reconciliation | Related discovery | Deep dive | Map decision | Next |
|---|---|---|---|---|---|
| 2026-09-01 | Direct set unobserved; no additions, changes, or removals inferred. Local fallback: 104 stable IDs / 125 occurrences, deduplicated by ID. | arXiv query for self-evolving/self-improving agents found `2608.22610v1`; full source reviewed. | Coalition pollution and cross-domain utility reversal. | Added three active clusters; selected reliability/authority at 13/15. | Restore observational collection reachability, then reconcile and prioritize any collected evaluator or skill-bank post; independently test the paper when code appears. |
| 2026-09-01 cycle 2 | Reconciled first at 10:00:06Z: direct set still unobserved; local fallback unchanged at 104 stable IDs / 125 occurrences and fingerprint `889d3247…d8fb`. | After reconciliation, arXiv HTML search returned `2608.30177` first; the specific API record and full source were readable. GitHub's complete nine-result `MemGauge` query found a pinned paper index but no attributable experiment repository. Reddit JSON returned HTTP 403; global search RSS returned metadata for `t3_1v8a3sh`, then its deep read returned HTTP 429. | Stage-wise utility-risk profiles across controlled interventions and four real systems. | Memory governance rises to 15/15 and qualifies the read-write synthesis; Reddit metadata remains a candidate, not claim support. | Reconcile XHS first again; look for attributable `2608.30177` code, then reproduce stage profiles under additional attacks. Revisit the Reddit candidate after the rate-limit boundary changes. |
| 2026-09-01 cycle 3 | Reconciled first at 10:12:33Z: direct set still unobserved; local fallback again unchanged at 104 IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb`. | Bounded GitHub repository searches were complete; the arXiv exact-ID feed returned `2604.16548v2`, `2606.04315v1`, and preserved `2608.30177v1`; Reddit post RSS returned `t3_1v8a3sh` plus six comments. | `2604.16548v2` lifecycle framework and five proposed governance predicates; Reddit claims kept attributable and non-empirical. | The 15/15 cluster and MemGauge anchor remain selected. The 14/15 marginal follow-up adds recoverability and lineage requirements without counting paper indexes or comments as confirmation. | Reconcile XHS first; deep-read `2606.04315v1` and test whether its active-control result entails safe write authorization, provenance, and principal scope. |
