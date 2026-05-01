# DD#650 — Contextual Control without Memory Growth

**Source**: arXiv:2604.03479 (Apr 2026)
**Rating**: ★★★★ HIGH
**Tags**: #context-management #compression #efficiency #memory #harness-engineering

## Key Idea

A technique for maintaining contextual control in long-running LLM agent sessions **without** the context window growing unboundedly. The paper addresses the fundamental tension: agents need history to maintain coherent behavior, but context windows are finite and expensive.

## Core Technique

The paper proposes a compression scheme that maintains **control-relevant context** (instructions, constraints, goals, active state) while aggressively compressing **informational context** (past observations, completed tasks, intermediate reasoning).

Key mechanism: **Contextual importance scoring** — each context segment is scored on how much it contributes to the agent's ability to follow its current control policy. High-importance segments are preserved verbatim; low-importance segments are summarized or dropped entirely.

This is different from simple truncation (which loses control context) or uniform summarization (which dilutes control signals).

## Results

The approach maintains agent control fidelity (instruction-following accuracy) while keeping context size bounded. The key insight is that **most of an agent's context history is informational, not control-relevant** — you can compress 80%+ of accumulated context without losing behavioral coherence.

## Relevance to Our Work

### P444: Control-Relevant vs. Informational Context Distinction
Not all context is created equal. Our agents (Scout, Bob) accumulate massive context over sessions — journal entries, paper summaries, todo lists. The control-relevant portion (current task, constraints, handoff protocol) is small. This paper validates aggressive summarization of everything else.

### P445: Bounded Context as System Requirement
For persistent agents (Springdrift-style), unbounded memory growth is a design flaw, not a feature. This paper provides principled techniques for keeping context bounded while maintaining control.

### R125: Apply Contextual Importance Scoring to GStack Agent Context
We could score our agent context (journal.md, todo.md, papers.md) by control-relevance. The current approach of reading everything each session is wasteful. A scoring system could identify which parts of the journal are still control-relevant (active handoffs, current task) vs. purely archival.

### R126: Compaction as Control-Preserving Compression
Our session compaction already does a version of this, but informally. This paper suggests we could formalize it: explicitly classify context as control-relevant vs. informational, and apply different compression ratios to each.

## Connection to Existing Work
- **CR#309 Memory Architecture Maturity Model**: This technique enables Level 3+ memory by preventing memory bloat
- **DD#646 MemMachine**: MemMachine preserves episodes verbatim; this paper argues you don't need to — only control-relevant bits matter
- **DD#645 MIA**: MIA's dynamic linking is a form of contextual importance — link to what matters
- **Harness Engineering**: Directly applicable to our long-running agent sessions where context management is a constant challenge
