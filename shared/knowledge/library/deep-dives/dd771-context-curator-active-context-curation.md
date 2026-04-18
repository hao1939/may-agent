# DD#771: Escaping the Context Bottleneck — Active Context Curation via RL

**Paper**: Escaping the Context Bottleneck: Active Context Curation for LLM Agents via Reinforcement Learning
**arXiv**: 2604.11462 | **Authors**: Xiaozhe Li et al. (9 authors) | **Submitted**: 2026-04-13
**Rating**: ★★★★★

## Core Idea

Decouples context management from task execution via a symbiotic architecture: a lightweight **ContextCurator** (7B, trained via RL) actively manages working memory while a frozen **TaskExecutor** (large foundation model) focuses on reasoning. ContextCurator reduces information entropy by aggressively pruning environmental noise while preserving "reasoning anchors" — sparse data points critical for future deductions.

## Key Results

- **WebArena**: Gemini-3.0-flash success rate 36.4% → 41.2% (+4.8pp) with 8.8% fewer tokens
- **DeepSearch**: 53.9% → 57.1% (+3.2pp) with **8× fewer tokens**
- **7B ContextCurator matches GPT-4o** at context management — proves this is a learnable, separable skill

## Why This Matters

1. **Context as first-class managed resource**: Not just "stuff the context window" — actively curate what stays
2. **Reasoning anchors**: Formalizes the intuition that a few critical data points matter more than volume
3. **Separation of concerns**: Small model handles context; big model handles reasoning — efficient division
4. **RL-trained curation**: The curator LEARNS what to keep, not hand-coded heuristics

## Direct Relevance to Our System

- Our agents suffer from context bottleneck (KE-210 on INDEX navigation, FM-1.3 on path errors from context overload)
- **heartbeat.md** is essentially a hand-coded context curator — this paper suggests it could be learned
- "Reasoning anchors" maps to our "critical info injection" (KE-011: knowledge files are passive, critical info must be injected)
- The 8× token reduction on DeepSearch is remarkable — suggests massive efficiency gains from intelligent context pruning

## Implications for Architecture

- Could train a lightweight context curator for agent sessions — decides what from shared/knowledge/ to inject
- Reasoning anchors concept formalizes what we do with context.md persistent facts
- RL training on curation means the system improves at context management over time
- Validates our instinct that context engineering > larger context windows

## Limitations

- Requires RL training infrastructure
- Focused on web/search tasks — unclear transfer to coding/research agents
- ContextCurator is task-agnostic within domain but unclear cross-domain transfer

## Connections

- **KE-011** (passive knowledge files): ContextCurator is the solution — active curation instead of passive availability
- **KE-210** (INDEX navigation): If the INDEX is the knowledge base, a curator could select relevant entries
- **DD#769** (heartbeat scheduling): Combined, you'd have heartbeat scheduling WHAT to think + context curation of WHAT to think about
- **CR#326** (gym-production gap): Context scale is one of their 5 gap dimensions — ContextCurator directly addresses this
