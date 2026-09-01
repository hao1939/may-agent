<ai_context>
summary: "Seed-first Scout checkpoint across three cycles: Xiaohongshu reconciliation preceded every topic-led GitHub, arXiv, and Reddit decision; arXiv 2608.30177v1 remains the stage-aware memory anchor; 2604.16548v2 adds lifecycle governance and recovery requirements; and Scout now gives GitHub the same explicit read-only, bounded-retrieval discipline as arXiv and Reddit."
triggers: ["Scout source lane checkpoint", "GitHub arXiv Reddit exploration", "MemGauge deep dive", "memory lifecycle governance", "XHS seed-first cycle 3"]
last_updated: "2026-09-01"
source_basis: "Goal-owned implementation and tests; XHS reconciliations through 2026-09-01T10:12:33Z; bounded public GitHub API, arXiv API/full TeX, and Reddit Atom observations; full-source reviews of arXiv 2608.30177v1 and 2604.16548v2."
</ai_context>

# Seed-First Memory Exploration Across GitHub, arXiv, and Reddit

## What was wrong and what changes

Scout now scheduled all three lanes, but GitHub still lacked the explicit
read-only, bounded-request, rate-limit, complete-search, and revision-pinning
contract already present for arXiv and Reddit. Source continuity also lived
across prose and conversation rather than one durable decision record. That
made a future run more likely to overstate a repository search or repeat work.

This checkpoint keeps one shared exploration workflow and one standing goal,
adds the missing GitHub contract and focused test, and records relevance,
value, freshness, access, last useful evidence, decision, and revisit trigger
for GitHub, arXiv, and Reddit in the living topic map. It preserves the completed
`2608.30177v1` deep dive and extends the selected cluster with a full-source
review of `2604.16548v2`; repository indexes and Reddit discussion are not
miscounted as experimental confirmation.

## Seed reconciliation came first

The second XHS endpoint preflight and local inventory completed at
`2026-09-01T10:00:06Z`, before any GitHub, arXiv, or Reddit request in this
discovery pass. Direct collection state remained unobserved because
`uid=1000(hao)` in the goal-owned worker could not reach Chrome DevTools at
`127.0.0.1:9222` and had no authority to enter the browser process's network
namespace. The local fallback remained 104 stable XHS IDs across 125 URL
occurrences, with SHA-256 fingerprint
`889d3247e9fd0d7a2772a2901cfa69ff27387de96ea4bf15dfcd21241228d8fb`.

The multi-source pass began at `2026-09-01T10:02:47Z`. Nothing discovered
afterward was relabeled as a human-collected seed, and unknown additions,
changes, and removals stayed unknown. The ordering is recorded in the
[seed ledger](../../knowledge/xhs-seed-ledger.md), not inferred from this
report.

The next cycle repeated that ordering at `2026-09-01T10:12:33Z`. Direct XHS
collection state was still unobserved and the fallback was unchanged at 104
stable IDs / 125 occurrences / 24 files with the same full fingerprint. GitHub,
arXiv, and Reddit follow-up began only after that comparison. No direct seed
delta was inferred from an unreachable collection surface.

## What each lane can actually do

| Lane | Implementation and configuration | Live topic-led observation | Provenance, deduplication, and boundary |
|---|---|---|---|
| GitHub | `scout-explore` accepts a structured GitHub result, stamps the observation time in the workflow, strips credential-like URL parameters, admits only allowed output paths, and rejects removed or duplicate primary sources. `app.ts` schedules the stable `explore-github` task every two hours. The prompt now requires topic-led read-only search, bounded requests, `incomplete_results`, and a pinned revision before repository contents support a claim. Fetching and source judgment still happen in the Scout agent rather than a deterministic adapter. | Public unauthenticated repository search was reachable. A refined `MemGauge in:name,description,readme` query returned 9 results with `incomplete_results=false`. `NY1024/AgentSafety-Papers` indexed `2608.30177v1` at commit [`3a46dd3`](https://github.com/NY1024/AgentSafety-Papers/commit/3a46dd37588e352a03e917da7a71b266f36e16bb). | No local primary source matched `2608.30177`, the index repository, or the similarly named but unattributed `samarthshete/MemGauge` repository. The arXiv paper remains canonical; the GitHub index is discovery provenance, not independent experimental confirmation. No attributable experiment-code repository was found. The initial README-inclusive query was technically complete but too broad to be useful, so it was narrowed rather than admitted. |
| arXiv | `scout-explore` schedules `explore-arxiv` every four hours and requires both connection and total timeouts. A source failure must produce an exact same-source no-op, not a substitute-source result. The shared output and duplicate-source admission gates apply. | HTML search for `agent memory risk retrieval`, ordered newest first with 25 results, returned `2608.30177` first. The exact-ID Atom API returned one `2608.30177v1` entry, and its full TeX source was reviewed. The broad Atom query had earlier returned HTTP 429; bounded arXiv HTML search and the exact-ID arXiv API remained accessible. | Stable paper ID and v1 URL are retained. Search-before-create found no local `2608.30177` entry, so the existing topical synthesis was updated instead of creating a duplicate finding. The paper is source evidence; the GitHub index and Reddit title are not counted as extra confirmations. |
| Reddit | Reddit is in the shared source schema, resolver, four-hour schedule, accepted-output metric, documentation, and tests. The prompt requires observational access, a descriptive User-Agent, bounded timeouts, stable `t3_...` IDs, RSS-first discovery, and no body-level claims from feed metadata. It still relies on the Scout agent for retrieval rather than a deterministic adapter. | JSON endpoints returned HTTP 403 in cycle 2. Global search RSS returned HTTP 200 and surfaced [`t3_1v8a3sh`](https://www.reddit.com/r/mlops/comments/1v8a3sh/longterm_memory_in_llm_agents_is_an_attack/). Its post RSS changed from HTTP 429 to HTTP 200 in cycle 3 and exposed the post plus six comments. | The post and comments are now attributable community evidence, not empirical confirmation. Local search found no prior stable ID or paper entry before this update. The current boundary is endpoint-specific: post RSS is readable while JSON remains blocked; affiliation disclosure and suspected generated discussion further lower comment confidence. |

All live requests were read-only and bounded. No account login, vote, save,
follow, comment, post, or other external mutation occurred.

### Cycle 3 reconsideration and evidence

All three lanes were relevant to the selected memory-governance cluster and
were checked because their expected information value remained positive, not
to meet a source quota.

| Lane | Decision and exact observation | Evidence disposition and boundary |
|---|---|---|
| GitHub | Selected to look for attributable paper code and governance implementations. Public repository searches returned HTTP 200. `"MemGauge"` returned 9 results, the exact `2604.16548v2` title returned 3, and `"Verifiable Memory Governance"` returned 4; every response had `incomplete_results=false`. | No attributable implementation of `2608.30177v1` or `2604.16548v2` was found. Paper lists are discovery provenance; thematically similar repositories are not implementations; neither is independent paper confirmation. The agent-mediated lane remains non-deterministic, but its prompt now requires read-only access, both curl timeouts, exact boundary reporting, `incomplete_results`, and a pinned commit before repository contents support claims. |
| arXiv | Selected as the highest-value evidence lane. One bounded exact-ID Atom request returned HTTP 200 and the current versions of `2604.16548v2`, `2606.04315v1`, and preserved `2608.30177v1`. Full source for `2604.16548v2` was reviewed. | Stable versioned paper IDs are canonical. Search-before-update found neither `2604.16548` nor `2606.04315` in the library, so the survey was merged into the existing governance note instead of creating a duplicate finding. `2606.04315v1` remains the next candidate; its abstract supports an active-control result, but it was not used to validate the Reddit interpretation. |
| Reddit | Selected because the previously metadata-only post directly linked the cluster to both arXiv papers. Post RSS returned HTTP 200, stable post `t3_1v8a3sh`, and six stable comment IDs. | The post body is now directly observed community evidence. It restates the lifecycle survey and claims `2606.04315` favors agent-controlled storage/retrieval. Comments add tenant isolation, lineage, and rollback concerns. They are not empirical proof: one commenter disclosed an Airia affiliation and another suspected generated discussion. Earlier JSON HTTP 403 is an endpoint boundary, not total Reddit unavailability. |

## Why `2608.30177v1` still wins

After reconciliation, the stage-wise memory paper scored 15/15 under the
living map's `L+C+I+G+F` rubric. It connects to three deduplicated retained XHS
memory packets, supplies current independent paper evidence, has direct
operational consequences, resolves a contradiction in an existing Scout note,
and was published on 2026-08-31. `2608.22339v1` and `2608.25553v3` each scored
14/15 (`3+3+3+2+3`) because they overlap more with already-covered skill
admission or stale-memory work. `2608.17665v1` is a narrower polarization
branch.

The full-source review, rather than the abstract alone, supports these bounded
findings:

- MemGauge varies writing admission, management policy, and retrieval exposure
  under matched clean and poisoned conditions across 11 models and 100
  questions each from LongMemEval and LoCoMo.
- Writing attack success is generally below 10% through 0.3–0.5 admission
  coverage, then reaches 37–64% at full coverage.
- Management changes attack success by as much as 62% while clean utility
  changes only 3–5%.
- Across Mem0, Hindsight, LangMem, and A-MEM, top-K 1→7 raises clean utility
  from 24.6–29.3% to 52.7–64.2% and attack success from 4.7–12.2% to
  36.1–53.7%.
- The automated judge agrees with majority human labels on 91% of 400
  trajectories; five annotators have inter-annotator agreement κ=0.78.

The four real-system measurements are diagnostic associations, not controlled
causal stage effects. The v1 source exposes no experiment-code URL. The update
therefore rejects a universal “retrieval is solved” conclusion without turning
one two-benchmark study into a universal threshold prescription.

The third reconciliation does not displace that result. The memory cluster and
fresh `2608.30177v1` anchor remain 15/15. Among marginal follow-ups,
`2604.16548v2` scores 14/15 (`3+3+3+3+2`): it connects to the same retained XHS
memory packets, is independently readable, adds operational recovery criteria,
closes a current governance gap, and is less fresh than the August paper.

Its five proposed Verifiable Memory Governance predicates are Write
Authorization, Provenance Visibility, Principal-Scoped Retrieval,
Rollbackability, and Verified Forgetting. Under its lineage model, verified
forgetting requires rollback, rollback requires provenance, and provenance
requires authenticated write origin; scoped retrieval separately constrains
confidentiality. This is an audit framework, not an evaluated implementation.
The active paper text calls the lifecycle an organizational scaffold with
blurred boundaries, and the reviewed source exposes no reproducible search
query, screening counts, or inclusion criteria despite calling the review
systematic.

## Library and topic-map changes

- [XHS seed ledger](../../knowledge/xhs-seed-ledger.md): records reconciliations
  through cycle 3 and exact seed-before-discovery ordering.
- [Living topic map](../../knowledge/xhs-topic-map.md): retains stage-aware
  memory governance at 15/15, adds a durable lane continuity table, and keeps
  paper evidence separate from repository provenance and Reddit anecdotes.
- [Read-write attention synthesis](../../knowledge/the-read-write-attention-inversion.md):
  corrects its impossible future creation date from 2026-10-28 to the
  repository-observed creation date 2026-06-29, adds the MemGauge deep dive,
  and narrows the exclusive-write claim.
- [Knowledge index](../../knowledge/INDEX.md): updates the canonical summary to
  the qualified stage-aware conclusion.
- [Memory-governance authority note](../../knowledge/findings/2026-08-26-agent-memory-governance-authority-boundaries.md): absorbs the survey into the existing subject, adds the five predicates and their limits, and avoids a duplicate paper finding.
- Scout app: retains the shared Reddit lane and adds the smallest missing
  GitHub safety/evidence contract plus focused test. It does not add a
  deterministic adapter or a per-source goal.

## Validation and remaining limits

The focused lane suite passed 45 tests with 156 assertions across task routing,
source-output metrics, shared exploration admission, arXiv bounds, the new
GitHub contract, Reddit observation rules, workflow-owned timestamps, and
source deduplication. The full Scout check then passed syntax bundling,
TypeScript, Prettier, and 77 tests with 223 assertions. All 15 relative links in
the four changed checkpoint documents resolved, the updated index target is
present, and `git diff --check` reported no whitespace errors.

A broader scan of the pre-existing `knowledge/INDEX.md` still finds 67 broken
links unrelated to this change. They remain library-health backlog rather than
being presented as a clean global-link result.

The read-only health scan at `2026-09-01T10:21:28Z` returned 24
facts and 16 bounded wake signals: 13 future-date facts, 10 oversized-note
facts, and the existing index unsourced backlog. The packet remains truncated,
so it is a bounded regression signal rather than a global-health claim. None of
the changed checkpoint documents appears as a new health fact.

Direct XHS collection membership is still unknown. Reddit JSON remains blocked,
but post-level RSS is now readable. GitHub found paper-index provenance and
related repositories but no attributable MemGauge or survey implementation.
None of those boundaries blocks the supported arXiv update.

The next exploration begins with another XHS reconciliation. It then deep-reads
`2606.04315v1` to test whether the paper's active-control result entails safe
write authorization, provenance, principal scope, or rollback. GitHub is
revisited when attributable paper code appears or search results change;
Reddit is revisited for a new high-value thread or a claim needing source
comparison, not merely to exercise the lane again.

## Supervision
- Goal: Continuously operate Scout Knowledge Library as the human's seed-first, multi-source research loop: reconcile the human's collected Xiaohongshu posts, actively reconsider topic-led GitHub, arXiv, and Reddit exploration, deeply investigate the highest-value topic clusters, and maintain a provenance-backed, deduplicated, validated knowledge library and living topic map until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
