---
summary: "An official AllSpark XHS post presents Iris as an open-weight search agent whose search training may transfer to general tool-use and cowork tasks, while its staged release separates current weights/evaluation code from a still-forthcoming data and training recipe."
triggers: ["Iris", "AllSpark", "search agent", "search training transfer", "tool-use transfer", "staged open release", "BrowseComp", "DeepSearchQA", "HLE"]
last_updated: "2026-09-17"
source_basis: "Body-level XHS post by 小红书技术REDtech (note 6aa7c58f000000002802e565), representing the releasing team's own announcement; no linked paper, repository, benchmark table, or training recipe was available in the inspected body."
---

# Iris: Search Training May Transfer, but Release Completeness Is Staged

<ai_context>
Use this note as an early official-team signal about Iris and the possible transfer of search-agent training to adjacent tool-use tasks. Do not treat it as independent benchmark validation or a complete reproducibility assessment: the inspected XHS body gives no scores, repository URL, fourth benchmark name, dataset details, or training recipe.
</ai_context>

**Observed:** 2026-09-17  
**Disposition:** New source-grounded finding  
**Coverage:** Full XHS text post and its single pinned author comment. The attached images, model artifacts, evaluation code, and experiments were not inspected in this assessment.

## Source

- **XHS body:** [小红书AllSpark发布开源Search Agent Iris](https://www.xiaohongshu.com/explore/6aa7c58f000000002802e565) — 小红书技术REDtech, note ID `6aa7c58f000000002802e565`

## What the source says

The official REDtech account describes a search agent that must search, read, reason, and decide when to stop in a live-web setting. It says AllSpark has released Iris's weights and evaluation code and plans to publish the complete data and training recipe later.

The post makes three attributed performance claims without supplying numerical scores in the text:

- Iris was evaluated on four search-related benchmarks, explicitly naming BrowseComp, DeepSearchQA, and HLE but not the fourth benchmark.
- The 35B model reportedly approaches trillion-parameter models, while the 397B model reportedly surpasses them on some benchmarks.
- Search capability reportedly transfers to General Tool Use and Cowork tasks.

These are release-team claims, not independent comparisons established by this note.

## Why it matters

Two distinct signals should not be collapsed:

1. **Possible capability transfer.** If the reported General Tool Use and Cowork gains survive controlled evaluation, search-agent training may be teaching a broader policy for evidence acquisition, tool sequencing, and stopping—not merely benchmark-specific retrieval. A useful follow-up would compare identical base models before and after search training on held-out non-search tool tasks.
2. **Release completeness is multidimensional.** Weights and evaluation code make model execution and scoring more inspectable, but they do not reconstruct how training tasks were generated, filtered for difficulty and solvability, or optimized. Because the announcement explicitly defers the data and full training recipe, “open source” here should not yet be read as end-to-end reproducibility.

The second point also affects the first: without the recipe and a matched base-model control, transfer cannot be attributed specifically to search training rather than model scale, data mixture, or another stage of post-training.

## Limitations and follow-up

- The source is the releasing team's announcement and contains no independent replication.
- The post body provides no benchmark scores, model baselines, inference budgets, sample counts, variance, or contamination controls.
- “Same-scale strongest open-source,” “approaches,” and “surpasses” are qualitative comparisons whose exact cells and settings cannot be recovered from the inspected text.
- A GitHub repository search by Iris/AllSpark terms returned no clearly matching repository during this run; the body itself did not expose a credential-free repository or paper URL.
- Revisit when the project page, model card, data, and full training recipe are published. Verify artifact identity, all four benchmark definitions, search budgets, matched pre/post-training controls, and the non-search transfer evaluation before promoting the claims beyond an official-team signal.
