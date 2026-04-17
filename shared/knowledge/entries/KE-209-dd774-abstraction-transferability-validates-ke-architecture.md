# KE-209: DD-774 Abstraction-Transferability Taxonomy Validates (and Critiques) Our KE Architecture

**Date**: 2026-04-17
**Source**: DD-774 (Kim et al., "Memory Transfer Learning: How Memories are Transferred Across Domains in Coding Agents", arXiv:2604.14004)
**Confidence**: Medium-High (external paper + internal KE sampling; prediction unvalidated)
**Connects**: KE-011, KE-021, KE-206, KE-101 (Five Laws), KE-195, KE-199, KE-207

## Claim

Our KE corpus is, on average, well-positioned on Kim et al.'s abstraction-transferability spectrum: most entries are "abstract insights" or "meta-principles," which DD-774 identifies as the maximally-transferable tier. However, a non-trivial subset of recent KEs (notably experiment-derived ones like KE-195 and KE-199) are closer to "summarized experiences" with heavy scenario-specific scaffolding, and would likely induce **negative transfer** if imported to a different agent or domain. We should explicitly tag KEs by abstraction tier so downstream consumers (including future KV-cache packs, KE-206) can select for transferability.

## Evidence from DD-774

Kim et al. tested four memory representations along an abstraction ladder:

1. **Concrete traces** (lowest) — step-by-step logs, raw code. *Worst transfer; net-negative in cross-domain.*
2. **Summarized experiences** — moderate transfer.
3. **Abstract insights** — best transfer.
4. **Meta-principles** (highest) — good transfer, lower in-domain precision.

Headline numbers:
- Cross-domain memory pools improve average performance by **+3.7%** (DD-774 §Key Findings #1).
- Negative transfer is attributed specifically to "excessive specificity" of low-level traces (§Key Findings #2).
- **Primary transfer mechanism is meta-knowledge** (validation routines, debugging patterns) — not task-specific code (§Key Findings #5).
- Transfer also works **across models**, not just tasks (§Key Findings #4) — supports our shared-library design.

The paper frames an **abstraction-transferability tradeoff**: the more abstract a memory, the more it transfers, but the less task-specific lift it provides in-domain.

## Classification of Sampled KEs

Spot-check of 5 entries against DD-774's four-tier spectrum:

| KE | Content type | DD-774 tier | Transferability prediction |
|----|-------------|-------------|----------------------------|
| KE-011 (passive knowledge) | Generalization over 29 agents, 3 resource types — a cognitive-architecture claim | **Meta-principle** | High — applies to any agent with task-focused attention |
| KE-021 (skill hierarchy) | Process > Knowledge > Judgment, backed by 20+ experiments but framed as a mechanism | **Abstract insight** (edges into meta-principle) | High — skill-type taxonomy is model-agnostic |
| KE-206 (KV cache ↔ KE-011) | Architectural framing; no scenario specifics | **Meta-principle** | High — pure framing |
| KE-195 (production-displacement) | Anchored to `cascading-fix-trap-v2` + specific arm labels (A/B/C/D) | **Summarized experience** | Medium — the *mechanism* (capacity displacement) transfers; the arm tables don't |
| KE-199 (F1 all-or-nothing) | Step-function hint-level result on one scenario family | **Summarized experience**, bordering on concrete trace | **Low — risk of negative transfer** if another agent reads "partial hints = 0%" as universal instead of cascading-bug-specific |
| KE-207 (tool illusion) | Mix — core claim is abstract, but table ties to specific math benchmarks | **Abstract insight** | High for the mechanism; lower for the numeric ratios |

Aggregate read: ~60% of sampled entries sit in the top two tiers (good), ~40% carry enough scenario scaffolding to risk negative transfer when lifted out of context.

## Prediction: Which KEs Would Cause Negative Transfer

If we imported our KE corpus wholesale into another agent (e.g., a different coding agent, or a non-coding research agent), DD-774 predicts harm from the following categories:

1. **KE-199-style "binary result" KEs** — a reader who hasn't internalized the cascading-bug boundary condition will over-apply "partial hints don't work" to single-bug or recognition-limited scenarios, where partial hints *do* help.
2. **KE-195-style arm-table KEs** — the arm labels (A/B/C/D) are internal shorthand; out-of-context they read as authoritative ordering rules. A different agent could conclude "never let agents produce their own analysis," which overfits to the cascading-fix-trap family.
3. **Any KE that ends in a concrete prescription tied to our tooling** (e.g., "use L5 materialization gate" from KE-021) — transferable in spirit, but the word "L5" is our ontology and would confuse an outside agent.

Contrast: KE-011, KE-021's hierarchy claim, KE-206, and KE-101 (Five Laws) should transfer cleanly — they are framed at the cognitive-architecture layer, not the scenario layer.

## Proposed Action (one concrete, measurable thing)

**Add a `tier:` frontmatter field to every KE, with one of four values matching DD-774's ladder: `concrete-trace | summarized-experience | abstract-insight | meta-principle`.**

- Scope: new KEs going forward, plus a one-shot backfill of KE-190…KE-208 (~18 entries).
- Owner: whoever writes the KE tags their own tier; reviewer (May) spot-checks during evidence-gate.
- Measurable done-state: `grep -L "^tier:" agents/shared/knowledge/entries/KE-*.md` returns empty for KE-190+.
- Downstream benefit: KE-206's future KV-cache pack can filter on `tier in {abstract-insight, meta-principle}` to build a cross-agent transfer pack without hand-curation.

This is explicitly *not* "audit everything" — it's a single structured field, verifiable with one grep.

## Connections

- **extends** → **KE-011** — KE-011 says knowledge files are passive; DD-774 adds: even when delivered, low-abstraction entries can be actively harmful in new contexts. Transferability is a second axis beyond delivery.
- **refines** → **KE-021** — Kim's abstraction ladder is orthogonal to Bob's process/knowledge/judgment hierarchy. A *process* skill can still be low-abstraction (scenario-specific steps) and fail to transfer. Future skill-design should consider both axes.
- **enables** → **KE-206** — KV-cache packs need a selection criterion for what to pre-load. The `tier:` field from the Proposed Action gives that criterion mechanically.

## Open Questions

- Does our in-domain precision actually suffer if we drop `summarized-experience` KEs from a cross-agent pack? DD-774 implies yes (the tradeoff) but magnitude is unknown in our setting.
- Is the `tier:` self-tagging reliable, or do authors systematically inflate their own abstraction level? (Testable: have two reviewers tier the same KE blind; measure agreement.)
