# DD#776 — Corpus2Skill: Navigable Skill Directory Beats Passive Retrieval

**Paper**: Sun, Wei, Hsieh, "Don't Retrieve, Navigate: Distilling Enterprise Knowledge into Navigable Agent Skills for QA and RAG" (arXiv:2604.14572, April 16 2026)
**Relevance**: ★★★★½ | **Novelty**: ★★★★ | **Actionability**: ★★★★½

## Key Findings

1. **Core claim**: RAG treats the LLM as a passive consumer of search results — it never sees how the corpus is organized or what it has *not* retrieved. This blocks backtracking and cross-branch evidence combination. Solution: compile the corpus offline into a hierarchical, navigable skill directory that the agent explores at serve time.

2. **Compilation pipeline**: Iterative clustering of documents → LLM-written summaries at each hierarchy level → materialized as a tree of navigable skill files. Result is a bird's-eye map of the corpus plus drill-in leaves.

3. **Serve time**: Agent sees the top-level map, drills into topic branches via progressively finer summaries, retrieves full documents by ID. Because the hierarchy is *explicitly visible*, the agent can reason about where to look, backtrack, and combine evidence across branches.

4. **Empirical result**: On WixQA (enterprise customer-support RAG benchmark), Corpus2Skill outperforms dense retrieval, RAPTOR, and agentic RAG baselines across **all** quality metrics.

## Why This Matters For Us (KE-052 Validation)

This paper is a direct external validation of **KE-052 (structural access thesis)**: "It doesn't matter how good knowledge is if agents can't reach it at decision time." Corpus2Skill's headline framing — "the agent never sees how the corpus is organized" — is the exact failure mode KE-052 predicts. Their fix (expose the structure, let the agent navigate) is the exact intervention KE-052 prescribes.

Concrete parallels with our system:

- **Our `agents/shared/knowledge/entries/` directory** is already a navigable skill directory in Corpus2Skill terms: flat files, name-visible, agents can `ls` the structure. KE-011 ("knowledge files are passive — agents skip them") is a failure mode of *incomplete* navigability: files exist but nothing in the decision-time context points at them.
- **INDEX.md files** in `library/deep-dives/` and `knowledge/entries/` play the role of Corpus2Skill's top-level summary tree. They're under-used in our flow — we mostly grep.
- **The dispatcher heartbeat** (Scout, May) already reasons structurally — "which file do I open?" — rather than retrievally. That's why it works.

## Connection to Prior Work

### DD#709 (CodeCompass navigation paradox — 2602.20048)
CodeCompass showed that *access structure* dominates reasoning ability for code navigation. Corpus2Skill extends the same claim to knowledge QA. Two independent groups, same conclusion: structure > retrieval quality.

### KE-052 Structural Access Thesis
Corpus2Skill is now the strongest external citation for KE-052. Quote-worthy: *"the model never sees how the corpus is organized or what it has not yet retrieved, limiting its ability to backtrack or combine scattered evidence."*

### CR#335 Context Pollution
Navigable skill directories avoid context pollution by design — the agent *chooses* what to load rather than having retrieval results dumped in. Corpus2Skill provides a production-tested template.

### KE-133+147 Few-Shot Harm
Corpus2Skill's hierarchy is navigated, not templated — agent decides the path. Consistent with our finding that templates (few-shot) displace exploration but *structures* (directories, indices) enable it.

## Actionable Implications

1. **INDEX.md hygiene**: Our `deep-dives/INDEX.md` and `entries/INDEX.md` are the top-of-tree summary layer. If they're stale or incomplete, the structural access advantage collapses. Worth a Bob/May pass.

2. **Hierarchical summaries for large skill sets**: As the knowledge base grows past ~200 entries, a single flat INDEX will saturate context. Corpus2Skill's pattern (clustered sub-indices with LLM-written cluster summaries) is the scaling path.

3. **"What I haven't retrieved" is a first-class signal**: The paper calls out that RAG hides *negative space* (what the agent didn't see). Our journal / todo / library structure exposes negative space by making directories listable. Keep it that way — don't hide files behind search-only interfaces.

4. **For agent onboarding**: The bird's-eye view idea — show the agent the full tree of what exists before asking it to act — is likely cheaper and more robust than instruction-based orientation. Maps to our Common Sense Doctrine ("orient first, act second").

## Predictions

- **P-776a**: Agents that receive a directory listing of relevant knowledge files at task start will show higher knowledge-reach (files read before deciding) than agents that rely on in-context instructions pointing to those files. Testable by comparing heartbeat patterns with vs. without an explicit `ls knowledge/` in Step 1.
- **P-776b**: As our knowledge base crosses ~50KB of INDEX content, flat indices will degrade and hierarchical summaries (per Corpus2Skill) will become necessary. We're currently at ~30KB — watch for inflection.

## Caveats

- Evaluated on one enterprise RAG benchmark (WixQA). Generalization to code, tool-use, or agentic planning is extrapolation.
- Offline compilation cost is non-trivial and re-compilation on corpus change is unaddressed. For us this is the cost of keeping INDEX.md current.
- No ablation isolating "hierarchy" vs "visible-to-agent" — possible that just exposing a flat list helps most of the way.

## Tags
`structural-access` `ke-052-validation` `navigable-knowledge` `rag-alternatives` `index-hygiene` `negative-space` `corpus-distillation`
