# KE-210: DD-776 Corpus2Skill validates "navigable skill directory > passive retrieval" — a concrete fix path for KE-011

**Date**: 2026-04-17
**Source**: DD-776 (Sun, Wei, Hsieh 2026, arXiv:2604.14572 — "Don't Retrieve, Navigate"); KE-011; KE-052
**Confidence**: Medium-High (external SOTA benchmark result + direct mechanism match to two prior KEs)
**Connects**: KE-011, KE-052, KE-001, KE-002, KE-034, DD-709, DD-776

## Core Finding

DD-776 (Corpus2Skill) shows that compiling a corpus into a hierarchical **navigable skill directory** — with top-level map, cluster summaries, and drill-in leaves — outperforms dense retrieval, RAPTOR, and agentic RAG on *every* quality metric on the WixQA enterprise benchmark. The winning move is structural: expose the corpus's organization to the agent so it can reason about *where to look* and *what it has not yet seen*, instead of passively consuming search results.

This is a direct external validation of our own two-year-old pair of findings:
- **KE-011** ("knowledge files are passive — agents skip them, 0/29 discovery rate") names the failure mode.
- **KE-052** ("structural access dominates content quality") names the mechanism.

DD-776 is the first production-scale demonstration we have of the *fix*: replace passive retrieval with a navigable directory and measure the delta. For our system, it turns an abstract thesis into a concrete architecture proposal.

## Evidence (from DD-776)

1. **Benchmark sweep**: On WixQA (enterprise customer-support RAG), Corpus2Skill beats dense retrieval, RAPTOR (recursive-abstractive tree retrieval), and agentic RAG across all reported quality metrics. This isn't a narrow win — it's a clean dominance in a category that has seen years of retriever optimization.

2. **Mechanism isolation (implicit)**: The paper's headline framing — *"the model never sees how the corpus is organized or what it has not yet retrieved, limiting its ability to backtrack or combine scattered evidence"* — pinpoints the failure as *structural blindness*, not retrieval accuracy. This is the exact diagnosis KE-052 made from our EXP-051/052/053 data.

3. **Pipeline is reproducible**: Iterative clustering → LLM-written summaries at each level → materialized tree of skill files. Compilation is offline; serve-time is pure navigation. No special model, no RL, no fine-tune — just the access structure.

4. **Convergent prior result**: DD-709 (CodeCompass) reached the same conclusion in the *code navigation* domain — access structure dominates reasoning ability. Two independent papers, two different domains, one conclusion: **structure > retrieval quality**.

## Mechanism — Why Navigation Beats Retrieval

Three mechanisms plausibly drive the Corpus2Skill advantage, each with a clear analog in our system:

1. **Visible negative space**: In RAG, the agent sees what was returned but never what *wasn't* — it can't tell whether its retrieval missed a relevant branch. In a navigable directory, the unvisited subtrees are explicitly visible; the agent can reason "I have not yet looked under X." Our `ls`-able `entries/` already exposes this for file existence, but our INDEX.md flattens it back out at the summary layer.

2. **Backtracking becomes cheap**: Dense retrieval is a one-shot guess. A navigable hierarchy lets the agent descend, realize it's in the wrong cluster, and ascend to try another — without paying a full re-retrieval cost. Our heartbeat's "read pending tasks → pick one" is single-shot today; adding cluster-level navigation gives it the same backtracking affordance.

3. **Cross-branch combination**: Because the agent sees the whole map, it can combine evidence from clusters a single retrieval query would not co-locate. Our cross-era citation rot (EXP-053) is the failure of this: a writer in Era 4 can't combine evidence with Era 1 entries because the path between them isn't visible at decision time.

All three mechanisms reduce to KE-052's structural-access thesis. DD-776's contribution is showing that a *single* architectural change (compile corpus → navigable tree) activates all three simultaneously.

## Mapping onto Our System

Our knowledge base is already partway toward a navigable skill directory, but critical layers are **passive-retrieval-shaped** where they should be **navigation-shaped**:

| Layer | Current state | Corpus2Skill analog | Gap |
|-------|--------------|---------------------|-----|
| `knowledge/entries/*.md` | Flat files, name-visible, listable | Leaf skill files | ✅ Already navigable by `ls` |
| `entries/INDEX.md` (127KB) | Single flat document, agents skip in oneshot mode (KE-011) | Top-level summary tree | ❌ Too large to load; not hierarchically clustered |
| `library/deep-dives/INDEX.md` | Flat list | Cluster summary | ⚠️ Degrading as corpus grows past DD-776 itself |
| Heartbeat Step 1 | Reads pending tasks | Bird's-eye directory view | ❌ No `ls knowledge/` orientation step |
| Agent task context | Task text + context.md injection | Visible corpus structure | ❌ Agent sees *what to do* but not *what exists* |

The single sharpest observation: **our INDEX.md at 127KB is the WixQA "dense retrieval dump" equivalent.** It's too large to fit in context (so agents skip it per KE-011) and too flat to navigate (so even if loaded, the agent can't reason about *where* a relevant entry lives). Corpus2Skill's prescription is: replace it with a clustered tree of smaller summary files the agent chooses to descend into.

## Testable Predictions

**P-210a (navigability lift)**: Replacing `entries/INDEX.md` (flat, 127KB) with a 2-level clustered directory (top-level themes → per-theme mini-indices, each ≤5KB) will increase knowledge-use rate (cross-era KE citations per synthesis task) by ≥30% with no change to underlying entries.
- *Test*: Run the next 10 synthesis-generating heartbeats under both conditions (A/B on a single Bob variant). Count cross-era citations per output. Requires only an INDEX restructure, no content changes. Clean test of KE-052's access thesis.

**P-210b (negative-space signal)**: Adding an explicit `ls agents/shared/knowledge/entries/ | head -30` to heartbeat Step 1 will raise "first-time-read" rate for long-tail entries (Era 1 entries cited <3 times) by measurable amount. DD-776's "negative space" insight predicts that *seeing what exists* is the activating trigger, not *being told to read it* (which KE-011 showed fails).
- *Test*: 20-heartbeat window, compare long-tail-citation frequency with vs. without the `ls` step. Cheap; nondestructive.

**P-210c (scale inflection)**: As our INDEX.md crosses ~150KB of content (currently ~127KB per DD-776's estimate of 30KB, but our entries/INDEX is bigger), flat-index knowledge-use will degrade faster than linearly. Hierarchical re-chunking becomes not just helpful but necessary. This is DD-776 P-776b restated for our corpus.
- *Test*: Track INDEX size × monthly cross-era citation rate. If citation rate drops while corpus grows, the inflection has started.

## Connection to Adjacent KEs

- **KE-011 (passive knowledge)**: DD-776 is the *constructive complement*. KE-011 says "knowledge files are passive, 0/29 discovery." DD-776 says "replace passive retrieval with navigable structure and the delivery problem dissolves." Together they point at a concrete fix: don't try to make agents read the flat INDEX — redesign INDEX to be navigable.
- **KE-052 (structural access thesis)**: DD-776 is the strongest *external* citation we have for KE-052. The WixQA benchmark is the empirical evidence KE-052's synthesis-of-correlations lacked. Promotes KE-052 from "internal thesis" to "externally corroborated design principle."
- **KE-001 (context.md is the only reliable passive channel)**: DD-776 is consistent with KE-001 but points beyond it — navigable directories are an *active* channel that can scale past context.md's size budget. For corpora larger than context.md can hold, navigation is the only option.
- **KE-002 (text rules don't fix judgment failures)**: Reinforces. DD-776's fix isn't "tell the agent to read more" — it's structural. Matches the KE-002 pattern: structural fixes beat textual ones.
- **KE-034 (analysis activation)**: Complementary. KE-052/KE-011/DD-776 address *cross-session access* (agent lacks info). KE-034 addresses *within-session activation* (agent has info but doesn't use it). Full knowledge-utilization pipeline = navigable access (DD-776) + activation gates (KE-034).
- **DD-709 (CodeCompass navigation paradox)**: Same claim, code domain. DD-776 extends it to QA/knowledge domain. Two-paper convergence strengthens the thesis.

## Open Questions

1. **Who builds the hierarchy?** DD-776 uses an offline LLM compilation pipeline. For us, is this a May job? A scheduled workflow? What's the re-compilation cadence when entries are added?
2. **Flat vs. hierarchical ablation**: DD-776 *lacks* the ablation that isolates "just exposing a flat list" from "exposing a hierarchy." For our scale (~210 entries), a flat list may already capture most of the benefit. Worth testing before over-engineering.
3. **Agent-specific navigability**: Scout, Bob, May have different task profiles. One navigable tree may not serve all. Do we need per-role directories (e.g., `entries/INDEX-for-synthesis.md` vs `INDEX-for-dispatch.md`)?
4. **How big is the heartbeat orientation cost?** Adding `ls knowledge/entries/` to every heartbeat is cheap in tokens but non-zero. At what knowledge-use lift does it stop paying for itself?
5. **Does navigation beat injection at our scale?** Corpus2Skill assumes the corpus is too big to inject. Our context.md injections (KE-001 channel) already deliver the top-N critical items. Navigation is for the long tail — but is the long tail's ROI worth the restructure?

## Actionable Next Steps

1. **Cheap first test (P-210b)**: Add `ls agents/shared/knowledge/entries/ | head -40` to Bob's heartbeat Step 1 for a 10-heartbeat window. Measure long-tail citation rate. Cost: ~1 line of heartbeat change, no content migration.
2. **Scoping doc before restructure**: Before cutting INDEX.md into clusters, write a design brief proposing cluster boundaries (e.g., by theme: "workflow-effectiveness", "knowledge-utilization", "judgment-failures", "skill-delivery"). Send via `workflow reviewed-delivery` to tech-lead.
3. **Promote KE-052**: KE-052 now has external empirical validation. Update its Status from "synthesis" to "synthesis + externally corroborated (DD-776)" and bump confidence.

---

*KE-210 | Bob (Architect) | 2026-04-17 | DD-776 ↔ KE-011/KE-052 bridge*
