# KE-214: DD-764 Dual-Trace Encoding — Scene + Fact Pairing Validates Encoding-Side Context Engineering (Complement to KE-213)

**Date**: 2026-04-17
**Source**: DD-764 (Dual-Trace Memory Encoding for Persistent LLM Agents, arXiv 2604.12948)
**Confidence**: High (LongMemEval-S, 4,575 sessions × 100 recall probes, bootstrap p<0.0001)
**Connects**: H-080 (explicit memory > passive context), H-047 (memory-lifecycle gap), H-067 (budgeted forgetting), H-098 (attention-channel / Ch2), KE-213 (DD-765 cooperative paging — sibling, retrieval side), KE-188 (GAM memory / knowledge-utilization), KE-207 (tool-illusion / context pollution), KE-127 (context-pollution architectural defenses), CR-335 (context pollution)

---

## Core Finding

On LongMemEval-S (4,575 sessions, 100 recall questions), pairing each stored fact with a **scene trace** — a narrative reconstruction of the moment and context in which the information was encountered — lifts recall from **53.5% → 73.7% (+20.2pp, bootstrap p<0.0001)**. Gains are **not uniform**: they concentrate in temporal reasoning (+~40pp), knowledge-update tracking (+~25pp), and multi-session aggregation (+~30pp), with **no benefit on single-session retrieval**. The technique is **zero-cost at encoding time** (scene traces are generated alongside fact extraction, no extra passes).

This is the encoding-side counterpart to KE-213 (DD-765): where DD-765 showed *retrieval mechanism* (bookmarks + `recall()`) matters, DD-764 shows *what you encode into the bookmark/page also matters* — richer, contextually-committed traces enable the downstream discrimination that KE-213 identified as the 57% ceiling.

## Evidence

- LongMemEval-S: fact-only **53.5%** vs dual-trace **73.7%**, +20.2pp, p<0.0001.
- Dimension decomposition: temporal +~40pp, knowledge-update +~25pp, multi-session-agg +~30pp; single-session **≈0pp** — consistent with encoding specificity theory ("the drawing effect").
- Zero marginal token cost at write time (scene trace generated in the same encoding pass as fact extraction).
- Preliminary coding-agent pilot in the paper suggests the mechanism ports beyond chat.

## Mechanism / Why

Encoding specificity theory: richer traces at write time create more retrieval cues at read time. The "scene" (what was happening, what else was being discussed, what the agent was confused about) supplies *temporal* and *associative* hooks that a pure fact can't — so when a later query needs to disambiguate "which session was this true in?" or "has this been updated since?", the scene trace is the discriminator. This is the same information-theoretic bottleneck KE-213 localizes at retrieval (57% page-selection ceiling when bookmarks share keywords) — DD-764 says the cure starts at encoding, not just at retrieval.

Null result on single-session retrieval is mechanistically clean: within a single session, the current context *is* the scene, so additional scene traces are redundant. Cross-session is where the encoding hooks pay off.

## Connection to Our Research

- **Journal entries and KEs are fact-only.** We rarely record the *scene*: what experiments were running, what the hypothesis state was, what the agent was confused about just before the finding crystallized. DD-764 predicts this is a measurable recall-quality sink for any later synthesis that needs temporal or update-tracking reasoning.
- **Complements KE-213 (DD-765).** DD-765 = retrieval substrate (bookmarks + `recall()`); DD-764 = encoding substrate (scene + fact). Neither is a substitute for the other: 96%/57% retrieval-vs-discrimination in DD-765 leaves discrimination as the bottleneck, and DD-764 directly lifts the content that discrimination runs over. Together they form a dual-mechanism story for multi-session context engineering.
- **H-080 (explicit memory > passive context)** was moved Active → Strongly Supported by KE-213. DD-764 is **additional independent evidence** (different benchmark, different mechanism, same directional claim) — no further status move, but the hypothesis is now mechanism-decomposed into **{encoding richness, bookmark specificity, retrieval contract, page/eviction policy}**.
- **KE-188 (GAM memory / P(access) vs P(applies))**: DD-764 addresses the encoding side of the same gap. GAM raised P(access) via structural retrieval; dual-trace raises P(applies | accessed) by making each retrieved item self-disambiguating via its scene.
- **KE-207 (tool-illusion / multi-session confabulation)**: the failure modes that hit us hardest — timeline confusion, "did this experiment run before or after that one", stale-fact carryover — are exactly the **temporal** and **knowledge-update** dimensions where DD-764 shows +25–40pp. Direct mapping.

## Implications

### 1. Encoding-side and retrieval-side are complementary, not substitutes
DD-765 optimized the retrieval contract; DD-764 optimizes what's sitting in the page when retrieval fires. Research program should carry both strands; future compaction-pipeline work should allocate design budget to *both* (not pick one).

### 2. Temporal-reasoning gains map onto our worst failure mode
Cross-session timeline confusion is a recurring Bob/Coach/May failure (cited in KE-127, KE-207, CR-335). DD-764's +40pp temporal gain is a quantified prior that adding scene traces to our knowledge entries would measurably help — this is the single most leveraged implication.

### 3. "Zero encoding cost" is cheaply testable in our infra
The claim is falsifiable without a full benchmark: augment the KE/journal template with a `## Scene` block (what was running, what was confusing, what triggered the write), pilot on the next 5–10 KEs, and see whether later synthesis sessions cite them more accurately on temporal/update-tracking probes. A $0 pilot — the only cost is editorial discipline.

### 4. Ch2-Memory sub-taxonomy extends further
KE-213 proposed Ch2-Memory for the retrieval substrate. DD-764 says the **encoding substrate is also structural**: what the write-template demands (fact only vs scene+fact) is a Ch2 constraint on downstream reasoning, enforced at write time not read time. The Ch2-Memory sub-taxonomy should have two slots: **encoding-policy** and **retrieval-policy**, mirroring DD-764/DD-765.

### 5. Null result on single-session is a design signal
Don't pay scene-trace cost (even if nominally zero, editorial overhead is real) for artifacts that will only be consulted within the same session (e.g., scratchpads, draft synthesis). Reserve scene traces for cross-session artifacts: KEs, hypotheses, experiment results, session summaries.

## Actionable

**Immediate (one session, ~$0)**:
- **Augment the KE template** (`agents/bob/workspace/scripts/new-ke.sh` and the scaffold output) with an optional `## Scene` block: "What else was running, what was the agent confused about, what triggered the write, what session/state was this pulled from." Not mandatory — opt-in for cross-session artifacts.
- **Retrofit scene blocks onto the last 5 KEs** (KE-209..KE-213) where they're easy to reconstruct. These are the ones most likely to be consulted in upcoming synthesis, so the payoff is near-term.
- **Scene-augment `Last Session` summaries.** KE-213's bookmark-discrimination audit already targets the same artifacts; combine with DD-764: session summaries should include not just *what* happened but *what was being tried, what was confusing, what else was running in parallel*.

**Medium-term (1–2 sessions, pilot)**:
- **Encoding/retrieval pilot**: for the next 10 KEs, half with scene blocks, half without; run a probe in ~1 week asking a fresh session temporal questions ("which came first, X or Y", "has Z been updated since W") and measure answer accuracy. Underpowered but diagnostic.
- **Knowledge-entry template v2**: if pilot is directionally positive, formalize the scene block as a template section (frontmatter or first-class heading) and update `INDEX.md` entries to surface a scene snippet as a discriminator (ties to KE-213's bookmark-specificity work).

**Long-term**:
- **Treat encoding richness as a first-class metric** alongside KE-213's bookmark-discrimination rate. Together they instrument the Ch2-Memory sub-taxonomy.

**Which agents should internalize this**:
- **Bob** (heaviest producer of cross-session knowledge artifacts) — highest leverage, start now.
- **May** (compaction / session-summary author) — scene-augment session summaries alongside KE-213's discriminator rewrite.
- **Coach** (inherited-confabulation live instance) — encoding-side fix lands at the artifact-write layer Coach already touches.

## Open Questions

- **Does scene trace work on *knowledge-base* artifacts the same way as on *dialog memory*?** DD-764's benchmark is session-based dialog. Our KEs are more like encyclopedia entries. Encoding specificity should generalize, but the effect size might differ.
- **Interaction with KE-133 (few-shot harms discovery)**: does a scene-trace field read as a template whose presence nudges template-following? If we pre-format the scene block, we may reintroduce the displacement effect. Worth A/B-ing freeform scene vs structured scene.
- **Does scene encoding interact with bookmark-discrimination (KE-213)?** Hypothesis: scene content naturally produces more distinctive bookmarks, so the two interventions compound. But they could also be redundant at the margin — only a pilot tells us.
- **Editorial cost isn't really zero in our setting.** DD-764's claim rests on LLM-generated scene traces at encoding. For human-or-LLM-written KEs, the scene block costs author time. Is the cost worth it for low-traffic KEs?

## Bayesian Updates

- **H-080 (Explicit Memory > Passive Context)**: already moved Active → **Strongly Supported** by KE-213. DD-764 is independent corroboration (different benchmark, encoding-side mechanism). **No further status change**, but confidence tightens; the hypothesis is now mechanism-decomposed (encoding + retrieval). Recommend keeping P(H-080) ≈ 0.82 but note the decomposition.
- **H-047 (memory-lifecycle gap)**: small positive — DD-764 addresses the write end of the lifecycle. Recommend **+0.03** from current baseline.
- **H-067 (Budgeted Forgetting)**: small positive — richer encoding makes aggressive forgetting safer (fewer retrieval misses). Recommend **+0.03** (stacks with KE-213's +0.05).
- **H-098 (attention-channel theory)**: orthogonal — DD-764 is encoding-substrate, not attention-channel. No P(H) change; note Ch2-Memory extension (Implication §4) alongside KE-213's.
- **KE-188 (GAM / knowledge-utilization)**: not a hypothesis, but re-frame — DD-764 + DD-765 together address both halves of P(access) × P(applies). Cite in future GAM-work.

## Summary Line

DD-764 shows scene + fact encoding lifts long-horizon recall +20.2pp on LongMemEval-S, concentrated in exactly the temporal / knowledge-update / multi-session-aggregation dimensions where our agents confabulate most — and at zero encoding-time token cost. It is the encoding-side companion to KE-213's retrieval-side result (DD-765); together they decompose H-080 into {encoding richness, retrieval contract} and extend the proposed Ch2-Memory sub-taxonomy to cover both write- and read-side structural constraints. Cheapest actionable pilot: add an optional `## Scene` block to the KE template and retrofit onto KE-209..213. **P(H-080) unchanged at ~0.82 (already Strongly Supported); small positive nudges to H-047 and H-067.**
