<ai_context>
summary: "Second seed-first Scout checkpoint: Xiaohongshu reconciliation preceded topic-led GitHub, arXiv, and Reddit discovery; arXiv 2608.30177v1 qualified an overstrong memory-governance synthesis; and Scout gained a bounded read-only Reddit lane."
triggers: ["Scout source lane checkpoint", "GitHub arXiv Reddit exploration", "MemGauge deep dive", "XHS seed-first cycle 2"]
last_updated: "2026-09-01"
source_basis: "Goal-owned implementation and tests; XHS reconciliation at 2026-09-01T10:00:06Z; public GitHub API, arXiv HTML/API/full TeX, and Reddit JSON/Atom observations beginning at 2026-09-01T10:02:47Z."
</ai_context>

# Seed-First Memory Exploration Across GitHub, arXiv, and Reddit

## What was wrong and what changes

Scout scheduled GitHub and arXiv, but Reddit was absent from the source union,
resolver, schedule, accepted-output metric, and tests. The existing memory
synthesis also said read architectures were solved and governance was
exclusively write-side. That was stronger than the current evidence supports.

This checkpoint adds Reddit to Scout's existing shared exploration workflow—no
new native or per-source goal—and gives it a read-only, timeout-bounded,
RSS-first contract. It also preserves and deep-dives arXiv `2608.30177v1`, then
qualifies the canonical memory synthesis: admission and management still
matter, but retrieval exposure is also a utility-risk control surface.

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

## What each lane can actually do

| Lane | Implementation and configuration | Live topic-led observation | Provenance, deduplication, and boundary |
|---|---|---|---|
| GitHub | `scout-explore` accepts a structured GitHub result, stamps the observation time in the workflow, strips credential-like URL parameters, admits only allowed output paths, and rejects removed or duplicate primary sources. `app.ts` schedules the stable `explore-github` task every two hours. Fetching and source judgment still happen in the Scout agent rather than a deterministic GitHub adapter. | Public unauthenticated repository search was reachable. A refined `MemGauge in:name,description,readme` query returned 9 results with `incomplete_results=false`. `NY1024/AgentSafety-Papers` indexed `2608.30177v1` at commit [`3a46dd3`](https://github.com/NY1024/AgentSafety-Papers/commit/3a46dd37588e352a03e917da7a71b266f36e16bb). | No local primary source matched `2608.30177`, the index repository, or the similarly named but unattributed `samarthshete/MemGauge` repository. The arXiv paper remains canonical; the GitHub index is discovery provenance, not independent experimental confirmation. No attributable experiment-code repository was found. The initial README-inclusive query was technically complete but too broad to be useful, so it was narrowed rather than admitted. |
| arXiv | `scout-explore` schedules `explore-arxiv` every four hours and requires both connection and total timeouts. A source failure must produce an exact same-source no-op, not a substitute-source result. The shared output and duplicate-source admission gates apply. | HTML search for `agent memory risk retrieval`, ordered newest first with 25 results, returned `2608.30177` first. The exact-ID Atom API returned one `2608.30177v1` entry, and its full TeX source was reviewed. The broad Atom query had earlier returned HTTP 429; bounded arXiv HTML search and the exact-ID arXiv API remained accessible. | Stable paper ID and v1 URL are retained. Search-before-create found no local `2608.30177` entry, so the existing topical synthesis was updated instead of creating a duplicate finding. The paper is source evidence; the GitHub index and Reddit title are not counted as extra confirmations. |
| Reddit | Before this checkpoint Reddit was unsupported. It is now in the shared source schema, resolver, four-hour schedule, accepted-output metric, documentation, and tests. The prompt requires observational access, a descriptive User-Agent, bounded timeouts, stable `t3_...` IDs, RSS-first discovery, and no body-level claims from feed metadata. It still relies on the Scout agent for retrieval rather than a deterministic Reddit adapter. | Global and `r/LocalLLaMA` JSON search, old-web JSON search, and `r/LocalLLaMA/new.json` returned HTTP 403 `text/html` network-security blocks to the unauthenticated worker. Global search RSS returned HTTP 200 Atom and surfaced metadata-only post [`t3_1v8a3sh`](https://www.reddit.com/r/mlops/comments/1v8a3sh/longterm_memory_in_llm_agents_is_an_attack/) dated 2026-07-27. Its title connects long-term agent memory with a persistent attack surface. | A post-level RSS deep read returned HTTP 429, so only the stable ID, URL, title, subreddit, and feed timestamp are observed. No body claim was admitted and no finding was created. Local search found no prior copy of that stable ID or URL. The current boundary is endpoint-specific: public search RSS supports metadata discovery; JSON is blocked and post-level deep reading is rate-limited. |

All live requests were read-only and bounded. No account login, vote, save,
follow, comment, post, or other external mutation occurred.

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

## Library and topic-map changes

- [XHS seed ledger](../../knowledge/xhs-seed-ledger.md): records the second
  reconciliation and exact seed-before-discovery ordering.
- [Living topic map](../../knowledge/xhs-topic-map.md): raises stage-aware
  memory governance to 15/15, records all three lane observations and
  boundaries, and keeps Reddit metadata separate from claim support.
- [Read-write attention synthesis](../../knowledge/the-read-write-attention-inversion.md):
  corrects its impossible future creation date from 2026-10-28 to the
  repository-observed creation date 2026-06-29, adds the MemGauge deep dive,
  and narrows the exclusive-write claim.
- [Knowledge index](../../knowledge/INDEX.md): updates the canonical summary to
  the qualified stage-aware conclusion.
- Scout app: adds Reddit to the source contract, stable resolver and schedule,
  output metric, operating guidance, and focused tests. The existing
  configurable XHS Chrome DevTools host/port change remains part of the same
  checkpoint because it is the smallest safe way to support explicit browser
  network wiring without copying credentials.

## Validation and remaining limits

The focused app suite passed 51 tests across app routing, source-output metrics,
shared exploration admission, the new Reddit contract, and XHS tooling. The
full Scout check then passed syntax bundling, TypeScript, Prettier, and 76 tests
with 210 assertions. All 14 relative links in the four changed checkpoint
documents resolved; the updated existing index target is present; and
`git diff --check` reported no whitespace errors.

The read-only health scan at fixed time `2026-09-01T10:15:00Z` returned 24
facts and 16 bounded wake signals: 13 future-date facts, 10 oversized-note
facts, and the existing index unsourced backlog. The packet remains truncated,
so it is a bounded regression signal rather than a global-health claim. None of
the changed checkpoint documents appears as a new health fact.

Direct XHS collection membership is still unknown. Reddit JSON and post-level
content are not currently readable from this worker. GitHub found paper-index
provenance but no attributable MemGauge code. None of those boundaries blocks
the supported arXiv update.

The next exploration begins with another XHS reconciliation. It then checks for
an attributable `2608.30177` code release and, if available, reproduces the
stage profiles under additional attacks and benign retrieval errors. The
metadata-only Reddit candidate is deep-read only after its rate-limit boundary
changes; it is never promoted from title to evidence in the meantime.

## Supervision
- Goal: Continuously operate Scout Knowledge Library as the human's seed-first Xiaohongshu research loop: reconcile the human's collected posts, discover related content, deeply investigate the highest-value topic clusters, and maintain a provenance-backed, deduplicated, validated knowledge library and living topic map until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
