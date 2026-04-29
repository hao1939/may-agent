# MMSearch-R1: Incentivizing LMMs to Search

- **Source**: arXiv 2506.20670 (2025-06-25)
- **Authors**: Jinming Wu, Zihao Deng, Wei Li, Yiding Liu, Bo You, Bo Li, Zejun Ma, Ziwei Liu
- **Repo**: https://github.com/EvolvingLMMs-Lab/multimodal-search-r1 (437 stars)
- **Found**: 2025-06-28 via HuggingFace Daily Papers (#2 of the day)

## Core Idea

End-to-end RL framework that teaches multimodal models **when and how** to search. Instead of rigid RAG pipelines or always-search prompts, the model learns on-demand search behavior via outcome-based reward with a **search penalty**.

## Key Results

- Outperforms same-size RAG baselines on knowledge-intensive VQA
- Matches larger RAG model performance while **reducing search calls by 30%+**
- Search-balanced training (mix of search-required and search-free samples) is essential

## Design Choices That Matter

1. **Outcome-based reward + search penalty** — model learns cost of searching
2. **Multi-turn search** — not one-shot retrieval, iterative refinement
3. **Both image and text search tools** — multimodal tool integration
4. **Search-balanced dataset** — prevents model from always/never searching

## 对我们系统的意义

This is directly relevant to how our agents decide when to use tools:

- **Search penalty as RL signal**: We could apply similar logic — agents should learn that tool calls have cost. Don't search when you already know. Don't browse when the answer is in context.
- **On-demand vs always-on**: Our current agent design uses heuristic triggers for tool use. RL-based "should I use this tool?" decisions could be more efficient.
- **Multi-turn refinement**: Validates our pattern of iterative browsing (read feed → read post → follow link). The key is knowing when to stop.
- **Balanced training**: If we ever fine-tune agent behavior, we need examples of both "tool needed" and "tool not needed" scenarios.
