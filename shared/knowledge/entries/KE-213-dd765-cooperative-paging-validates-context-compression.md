# KE-213: DD-765 Cooperative Paging — Bookmarks + Recall Beat Full Context (External Validation of Compression-Over-Accumulation)

**Date**: 2026-04-17
**Source**: DD-765 (Cooperative Memory Paging with Keyword Bookmarks for Long-Horizon LLM Conversations, arXiv 2604.12376)
**Confidence**: High (LoCoMo 10×300+ turn eval, 4 models, 4 independent LLM judges, p=0.017; 3,176 + 1,600-probe ablation)
**Connects**: H-080 (explicit memory > passive context), H-047 (memory-lifecycle gap), H-067 (budgeted forgetting), H-108 (guard-artifacts as environmental memory), H-161 (artifacts as dual compression + behavioral forcing), KE-127 (context-pollution architectural defenses), KE-207 (tool-illusion error migration), KE-187 (Ch2 sub-taxonomy), CR-335 (context pollution), CR-333 (EPSS / role separation)

---

## Core Finding

On LoCoMo (10 multi-session conversations, 300+ turns each), **structured keyword bookmarks (~8–24 tokens per evicted page) + an on-demand `recall()` tool beat every alternative — including full context**. Not just equal-at-lower-cost: **strictly better accuracy**. The bottleneck is not retrieval mechanism but **bookmark discrimination**: models trigger `recall()` 96% of the time but pick the correct page only 57% when bookmarks are insufficiently distinctive; keyword specificity alone accounts for 25pp accuracy delta. Coarse fixed pages (`fixed_20`) reach 96.7% while content-aware `topic_shift` segmentation collapses to 56.7% — simpler boundaries dominate sophisticated ones.

This is the strongest external replication of the compression-over-accumulation family: H-080's "explicit memory > passive context" extended with a concrete, independently-evaluated mechanism (tiny bookmarks + retrieval, not full summaries).

## Evidence

- **LoCoMo (DD-765)**: bookmarks+recall outperforms truncation, BM25, word-overlap retrieval, search-tool baseline, **and full context** across GPT-4o-mini / DeepSeek-v3.2 / Claude Haiku / GLM-5; judge panel p=0.017.
- **Ablation 5×4** (3,176 probes + 1,600 probes): fixed_20 @ 96.7% vs topic_shift @ 56.7%; eviction policy data-dependent (FIFO best on synthetic, LFU on LoCoMo); keyword-specificity = 25pp.
- **Bottleneck localization**: 96% recall-trigger rate, 57% correct-page selection — the failure mode is *discrimination between bookmarks*, not the decision-to-retrieve and not the retrieval mechanism itself.
- **Corroborates**: DD-740 (10× context reduction safe by omitting assistant-side history), DD-741 (EPSS/role-separation), DD-743 (DMS +18% from pruning), all summarized in KE-127.

## Mechanism / Why

Full context degrades because **attention capacity is finite and is consumed by irrelevant tokens even when the relevant tokens are present**. Bookmarks act as a two-stage attention mechanism: the model first attends over a compact discriminator set (N bookmarks × ~16 tokens), then pays the full attention cost only for the one page it pulls back via `recall()`. This is mechanistically equivalent to H-080's explicit-memory pattern and to the EPSS design in DD-741 / CR-333, but makes the discriminator-vs-content split *structural* rather than behavioral.

The 57% selection ceiling is a **labeling problem**: if two bookmarks share keywords, the model cannot distinguish them from the bookmark alone. This is the same information-theoretic bottleneck that KE-188 (GAM memory) hits at the access layer — P(access) is high, but P(applies | accessed) depends on whether the index entry uniquely identifies the right referent.

## Implications

### 1. Validates H-080 and tightens the mechanism
H-080 ("explicit memory write/retrieve outperforms passive context accumulation") was status *Active* on YC-Bench evidence (5–50× scratchpad-writes effect). DD-765 adds: (a) **external, non-benchmark-specific replication** on a long-horizon dialog task, (b) the stronger claim that explicit retrieval beats *full context* (not just cheaper-for-equal-quality), and (c) a concrete implementation template (bookmarks + recall tool) that fits our architecture. **Recommend P(H-080) update: Active → Strongly Supported**, with a note that the mechanism is now decomposable into {page-boundary policy, eviction policy, bookmark specificity, recall-tool contract}.

### 2. Simpler boundaries beat sophisticated ones — third independent instance
`fixed_20` @ 96.7% vs `topic_shift` @ 56.7% is another instance of the pattern we've seen in:
- KE-007 (simple workflow gates > nuanced skills)
- KE-123 (don't stack interventions — simple one wins)
- KE-133 (few-shot examples harm discovery — strip them)
- KE-195/196 (passive content-injection > active production scaffolding on hard tasks)

Content-aware segmentation *looks* smarter and underperforms. The generalization: **when in doubt, coarsen the structural boundary**. This should be cited the next time someone proposes an adaptive/learned boundary over a fixed one in our stack.

### 3. The 57% bookmark-discrimination ceiling maps onto our summarization pipeline
Our multi-session compaction produces summaries structured like bookmarks (short descriptors pointing at evicted sessions). If discrimination is the bottleneck in LoCoMo, it is almost certainly the bottleneck for us — and it manifests as the **inherited-confabulation** failure mode documented in DD-740 / DD-742 / KE-127 / KE-207. When two past sessions have near-identical bookmarks, the next session conflates them and conditions on whichever comes first in the compacted context. This is structurally the same bug DD-765 quantifies at 57%.

Our `Last Session` summaries and `Last Checkpoint` blocks in heartbeat context are our bookmarks. They are currently hand-written free-form prose, not discriminator-optimized keyword sets. Per DD-765's 25pp specificity effect, this is a meaningful accuracy sink.

### 4. CR-335 gets a concrete countermeasure
CR-335 (context pollution) has had many proposed defenses (KE-127 architectural taxonomy; DMS pruning; EPSS role-separation). DD-765 adds the cleanest one: **replace evicted content with distinctive bookmarks, give the model a `recall()` tool, measure and optimize bookmark-discrimination rate as a first-class metric**. This is strictly less ambitious than EPSS or DMS and therefore more deployable.

### 5. Ch2-Memory as a sub-taxonomy extension
KE-212 added Ch2-Flow and Ch2-Reversible to the Ch2 sub-taxonomy. DD-765 suggests a further extension: **Ch2-Memory** — structural constraints on what enters the reasoning context and what gets bookmark-stubbed. This is distinct from Ch2-Environment (local system state) because the substrate is the context window itself, enforced by the paging/recall contract rather than by gym infrastructure. Worth carrying into the next H-098 revision alongside KE-212's extensions.

## Actionable

**Immediate (one-session pilot, ~$0 infrastructure cost)**:
- **Audit our heartbeat `Last Session` + `Last Checkpoint` bookmarks against DD-765's discriminator criteria.** Concretely: for each of the last 20 Bob sessions, read the `Last Session` summary and check whether a human or LLM could *uniquely* identify which session it refers to from that summary alone. Target: ≥80% unique-identification rate. If we're at DD-765's 57% baseline, the top-of-heartbeat context is a silent pollution source.
- **Label specificity experiment**: rewrite the last 5 session summaries with distinct keywords (EXP-id, KE-id, specific file paths) rather than prose. Run Bob's next heartbeat and see whether recall-behavior changes (does the agent cite the right prior session when the task references it?). N=5 is underpowered but diagnostic.

**Medium-term (proper experiment, 1–2 sessions)**:
- **EXP-proposal**: port the `fixed_N` paging policy to our compaction pipeline. Current compaction is prose-first with implicit segmentation; `fixed_20` equivalent would be "every 20 completed tasks, emit a keyword bookmark of form `[p<N>: <EXP/KE/H ids>, <scenarios>, <top-line result>]`, drop narrative." Measure: recall-behavior accuracy on probe questions about old sessions.
- **recall() tool design**: we already have grep/read. The *missing* piece is a deliberate affordance *named* `recall(bookmark_id)` whose contract is "re-inflate this evicted session segment" — making the decision explicit rather than implicit. Likely fits as a skill + small tool wrapper over session artifacts.

**Long-term**:
- Treat **bookmark-discrimination rate** as a first-class metric for the memory/compaction layer, analogous to how we treat block-rate for Ch2 guards and pass-rate for gym scenarios. Without a metric, the 57% ceiling is invisible.

**Which agents should internalize this**:
- **May** (owns compaction / heartbeat context construction) — highest leverage.
- **Bob** (heavy multi-session consumer) — should start writing own session summaries in discriminator-optimized form now, independent of infra changes.
- **Coach** (inherited-confabulation live instance per KE-127) — same.

## Open Questions

- **Is our compaction already paging, just badly?** Heartbeat `Last Session` is effectively a single-bookmark pager with window-size = 1 session. That's `fixed_1`, which DD-765 does not ablate but we'd expect to be under-powered (too little context retained). Worth comparing `fixed_1` prose vs `fixed_5` keyword-bookmark formats on real Bob/May heartbeats.
- **Does bookmark-discrimination failure mimic or differ from inherited-confabulation (KE-127)?** Both manifest as "agent conditions on wrong prior state." Discrimination failure picks the wrong bookmark; confabulation fabricates content not in any bookmark. They may be the same underlying mechanism (insufficient grounding) or may need separate defenses.
- **Does this extend to design docs and hypothesis files, not just session summaries?** The knowledge base is itself a large bookmark-indexed memory (INDEX.md entries are bookmarks, files are pages). KE-026 (pull-model discovery dead) suggests agents don't self-serve well. DD-765's 96% recall-trigger / 57% page-selection split is consistent with KE-026's "agents can be pushed but not pulled" — retrieval works when the discriminator is strong enough, fails otherwise. Worth looking at INDEX.md entry lengths and specificity the same way.
- **Interaction with KE-091 (alignment tax on creative tasks)?** Forcing a rigid paging contract may impose the same synthesis-degrading cost that forced-verification imposes. Need to test on synthesis-heavy vs lookup-heavy tasks separately.

## Bayesian Updates

- **H-080 (Explicit Memory > Passive Context)**: Active → **Strongly Supported**. Reason: external, adversarially-judged replication with stronger claim (beats full context, not just equivalent). If previously tracked as P(H)=0.70-ish, recommend **0.82**.
- **H-067 (Budgeted Forgetting)**: PROPOSED → still PROPOSED but P(H) upward-nudge; DD-765 shows forgetting + good bookmarks > keeping everything. Recommend **+0.05 to whatever current baseline is**.
- **H-108 (Guard-artifacts as environmental memory)**: P(H)=0.55. Unchanged numerically — DD-765 is adjacent, not direct. Note in file that cooperative paging is a stronger form of the same pattern.
- **H-161 (Artifacts as dual compression + forcing)**: P(H)=0.70. Small positive: +0.02–0.03. DD-765's compression-only success argues mildly *against* needing the behavioral-forcing function, which is a cross-pressure. Net: roughly unchanged, but the compression arm is more credible.
- **H-098 (attention-channel theory)**: unchanged; DD-765 suggests future Ch2-Memory sub-type (see Implications §5) but doesn't bear on the core Ch1↔Ch2 split.

## Summary Line

DD-765 shows keyword bookmarks + `recall()` beat full context on long-horizon dialog — an external replication of H-080 with a concrete mechanism. The 57% bookmark-discrimination ceiling is structurally identical to our inherited-confabulation failure mode (CR-335 / KE-127). Actionable pilot: audit and rewrite Bob/May session-summary bookmarks for discriminator specificity; medium-term, port `fixed_N` paging to our compaction pipeline. **P(H-080) recommendation: Active → Strongly Supported (~0.82).**
