# DD#866 — ADEMA: Knowledge-State Orchestration for Long-Horizon Synthesis

**Paper**: arXiv:2604.25849 (Apr 28, 2026)
**Authors**: Zhou Hanlin, Chan Huah Yong
**Relevance**: ★★★★★ — Direct architectural parallel to our system

## Core Idea

ADEMA is a knowledge-state orchestration architecture for long-horizon LLM agent tasks. The key insight: **tasks fail not because answers are unattainable, but because knowledge states drift across rounds**, intermediate commitments remain implicit, and interruption fractures the evidence chain.

## Key Mechanisms

1. **Explicit Epistemic Bookkeeping** — Track what the system knows, believes, and has committed to at each step. Prevents knowledge drift.
2. **Heterogeneous Dual-Evaluator Governance** — Two different evaluators (not just one) check output quality from different perspectives.
3. **Adaptive Task-Mode Switching** — System changes behavior based on task phase (exploration vs. exploitation).
4. **Reputation-Shaped Resource Allocation** — Allocate more compute to agents/paths with better track records.
5. **Checkpoint-Resumable Persistence** — Explicit checkpointing so interruptions don't lose progress.
6. **Segment-Level Memory Condensation** — Compress completed segments rather than keeping full history.
7. **Artifact-First Assembly** — Build concrete artifacts early, iterate on them (vs. planning then building).
8. **Final-Validity Checking with Safe Fallback** — Don't just check if output looks good; verify it works, with fallback.

## Critical Finding

From their 60-run mechanism matrix: **removing checkpoint/resume was the only ablation that produced an invalid run** (in the interruption-sensitive condition). Other mechanisms (dual evaluation, segment synthesis, dynamic governance) are "supporting control mechanisms" — helpful but not strictly required for completion.

## Connections to Our System

| ADEMA Mechanism | Our System Equivalent | Gap/Opportunity |
|---|---|---|
| Epistemic bookkeeping | context.md + journal.md | We don't explicitly track "what we know vs. believe" — could reduce knowledge drift |
| Dual evaluator | reviewer + evaluator | We have this! But not heterogeneous by design |
| Checkpoint/resume | .state/checkpoints/ | We have this — paper validates it's the #1 critical mechanism |
| Memory condensation | context compaction | OpenClaw finding (persona drift 90% from compaction) — tension with ADEMA's approach |
| Reputation allocation | metrics-based nudging | Coach does this informally; could be more explicit |
| Artifact-first | Write skeleton early | Context matches our "create output file turns 1-3" rule |

## Hypothesis Connection

**H-EXP-055 (context fragmentation)**: ADEMA's epistemic bookkeeping is exactly the mechanism that would address context-fragmented violations. Their explicit state tracking prevents the drift that causes fragments of knowledge to become inconsistent across agents.

## Actionable Takeaway

The strongest signal: **explicit epistemic state tracking** is worth prototyping. We currently track what agents *did* (journal) but not what they *know* (epistemic state). A lightweight "what I know, what's uncertain, what's committed" section in agent context could reduce the context fragmentation problem.

## Tags
#multi-agent #knowledge-management #orchestration #checkpoint #epistemic-state
