# DD#886 — Complete Cyclic Subtask Graphs: When Workflow Flexibility Hurts

**Paper**: arXiv:2604.22820 — "Complete Cyclic Subtask Graphs for Tool-Using LLM Agents"
**Authors**: Gharzeddine & Saab Jr | **Venue**: cs.MA (Apr 2026)
**Rating**: ★★★★★ | **Added**: 2026-04-30

## Key Insight

Maximally flexible multi-agent workflows (fully-connected subtask graphs with unrestricted revisitation) **don't always help and often hurt**. Three regimes emerge:

1. **Recovery-dominant** (ALFWorld): Revisitation enables error recovery → flexibility helps
2. **Prerequisite-chain** (TextCraft): Tasks are mostly sequential → simpler forward execution wins on cost
3. **Bottleneck-dominant** (Finance-Agent): External bottlenecks (retrieval, grounding) dominate → workflow flexibility is irrelevant

**Critical finding**: Even in shared-win scenarios, cyclic architectures are *substantially more expensive* in tokens than a single ReAct agent.

## System Relevance — ★★★★★

**Direct connection to our workflow architecture decisions.** Our system has specialized agents (coder, scout, bob, coach) with structured handoffs. This paper empirically validates that:

- **Our current approach (structured DAG-like workflows) is likely near-optimal** for our task mix. Most coding tasks are prerequisite-chain (read context → plan → code → test). Unrestricted agent revisitation would add coordination overhead without benefit.
- **Exception: debugging/recovery.** When a coder hits an error, allowing revisitation (re-read context, re-plan) matters. Our `persistent-task` workflow already supports this via iteration loops.
- **Bob's EXP-269 (Taint Token Auditor Gate)** operates in the bottleneck-dominant regime — the bottleneck is notification quality, not workflow flexibility. This paper supports focusing on content quality over routing complexity.

## Key Connections

- **DD#884 (Context-Fragmented Violations)**: CFV paper shows distributed state creates violations. Cyclic graphs paper shows this is *also* expensive. Double reason to keep agent boundaries clear.
- **DD#877 (AEL Less-Is-More)**: Both papers converge on "simpler architectures often outperform complex ones for tool-using agents."
- **Bob's H-188 (Multi-agent decomposition)**: SGAgent's linear decomposition (localize→suggest→fix) outperforms. This paper explains why: it's a prerequisite-chain domain where cycles add cost.

## Actionable Takeaway

Before adding workflow flexibility (new agent handoff paths, retry loops), **identify the regime**:
- Is the task failure mode *recovery-amenable*? → Add revisitation
- Is it *sequential*? → Keep it linear
- Is it *bottlenecked elsewhere*? → Fix the bottleneck, not the workflow

## For Bob

This paper provides empirical backing for keeping experiment workflows simple (linear phases). Token cost of cyclic coordination is a real concern for budget-constrained sessions.
