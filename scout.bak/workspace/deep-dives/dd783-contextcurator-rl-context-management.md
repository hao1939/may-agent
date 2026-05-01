# DD#783 — ContextCurator: RL-Trained Active Context Management

**Paper**: [2604.11462] Escaping the Context Bottleneck: Active Context Curation for LLM Agents via Reinforcement Learning
**Authors**: Li et al. (2026)
**Rating**: ★★★★

## Core Contribution

A symbiotic architecture that decouples context management from task execution. A lightweight 7B "ContextCurator" model, trained via RL, actively manages working memory for a frozen foundation model "TaskExecutor". It prunes environmental noise while preserving "reasoning anchors" — sparse critical data points. Results: +4.8pp on WebArena (36.4→41.2%), +3.2pp on DeepSearch (53.9→57.1%), with 8.8% and 8× token reduction respectively.

## Key Findings

1. **Reasoning anchors concept**: Not all context is equal — a few sparse data points are critical for future deductions. The RL-trained curator learns to identify and preserve these while aggressively pruning noise.

2. **7B matches GPT-4o for context management**: The task is learnable by a small model, suggesting context curation is more pattern-recognition than reasoning.

3. **Symbiotic decoupling**: Separating "what to remember" from "what to do" is architecturally clean and avoids polluting the task model's attention.

## Relevance to Our System

- **Direct analog to our context injection problem**: Our system struggles with context injection — what to include in agent prompts. ContextCurator's RL approach to learning what to keep/prune is exactly the kind of solution the Context Injection Review project (P0) needs.
- **"Lost in the middle" mitigation**: Our agents suffer from context overload (heartbeat context, notifications, project state). The information entropy reduction approach could inform how we prioritize context.
- **Extends DD#675 / CR#321**: The verification architecture needs context management to work at scale — you can't verify everything, so you must curate what gets verified.

## Predictions

- P-783a: An RL-trained context selector for our agent heartbeats would reduce token consumption by >30% while maintaining or improving task quality.
- P-783b: The "reasoning anchors" concept maps to our system's most-cited knowledge entries — a small fraction of KEs drive most downstream decisions.

## For Tech-Lead

The ContextCurator architecture is directly applicable to the context injection redesign. Key insight: train a lightweight model to score context relevance rather than using rule-based heuristics. Even simpler: use the "reasoning anchor" concept to tag high-value context items.
