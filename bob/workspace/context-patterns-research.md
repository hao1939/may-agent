# Context Management Patterns for Long-Running LLM Orchestration

**Date**: 2026-04-16  
**Author**: Bob  
**Problem**: persistent-task workflow accumulates context each iteration (worker results, reviewer assessments, tool calls) and overflows after many iterations.

## Our Current Approach

`persistent-task.ts` already implements two mitigations:
1. **Sliding window**: Worker prompt includes only last 3 iterations (lines 208-220)
2. **Pruning with collapse**: After 5 iterations, old iteration blocks are collapsed to one-line summaries (lines 280-320, `KEEP_RECENT = 5`)

The project markdown file grows monotonically — collapsed summaries accumulate, and the file itself is never truncated. The worker sees a bounded window, but the *file* still overflows eventually, and the review prompt gets the full recent progress.

## Known Patterns (Literature + Scout's Research)

### Pattern 1: Cooperative Memory Paging (DD-765)
**Source**: arXiv:2604.12376  
**Mechanism**: Evicted context replaced with keyword bookmarks (`[p3: auth, retry, timeout]`, ~8-24 tokens). Agent has a `recall(pageN)` tool to retrieve full content on demand.

**Key finding**: Paging with bookmarks **outperforms full context** — not just cheaper, actually better quality. The model focuses better when irrelevant history is out of the window.

**Design insight**: Coarse fixed-size pages (e.g., every 20 turns) beat sophisticated topic-shift segmentation. Simple wins. The hard problem is bookmark quality — model selects the right page only 57% of the time when bookmarks aren't distinctive enough.

**For us**: Instead of collapsed one-line summaries, store iteration blocks to external files and leave keyword bookmarks in the project file. Give worker a tool to recall specific past iterations.

### Pattern 2: Ephemeral-Persistent State Separation (CR-335, citing CodeDelegator)
**Source**: arXiv:2601.14914  
**Mechanism**: Strategic "delegator" agent keeps high-level state; each sub-task gets a fresh agent with clean context containing only its specification. Prior debugging traces and failures are completely isolated.

**Key principle**: Shield new work from prior failures through architectural separation.

**For us**: Our worker already gets a fresh session each iteration — that's good. But we inject "recent progress" which can include failure traces. Consider filtering: pass only *conclusions* from prior iterations, not the reasoning/debugging traces.

### Pattern 3: Hierarchical Memory with Encoding/Consolidation Decoupling (DD-768, GAM)
**Source**: arXiv:2604.12285  
**Mechanism**: Separate "event progression graph" (fast, current dialogue) from "topic associative network" (consolidated only on semantic shifts). Retrieval uses graph-guided multi-factor matching.

**For us**: Instead of linear iteration-by-iteration history, maintain a structured summary organized by *topic/decision* rather than by iteration number. E.g., "decisions made", "files modified", "open questions" — not "iteration 1 did X, iteration 2 did Y".

### Pattern 4: Selective Context Filtering (CR-335, citing Huang et al.)
**Source**: arXiv:2602.24287  
**Mechanism**: Models over-condition on their own prior outputs. Omitting assistant-side history reduces context by 10x with no quality loss on ~36% of turns. Selective filtering keeps only turns that measurably improve the next response.

**For us**: Our collapsed summaries include both worker results and owner assessments. The owner assessments ("CONTINUE: do X next") are probably the highest-value context. Worker reasoning traces are probably low-value after the iteration ends. Filter aggressively: keep only the owner's steering directives.

### Pattern 5: Dual-Trace Memory Encoding (DD-764)
**Source**: arXiv:2604.12948  
**Mechanism**: Each stored fact paired with a narrative "scene trace" of when/why it was learned. +20pp retrieval accuracy, especially for temporal reasoning (+40pp) and knowledge-update tracking (+25pp).

**For us**: Less directly applicable to the overflow problem, but relevant if we move to external memory retrieval — scene traces would help the worker understand *why* a prior decision was made, not just *what* was decided.

### Pattern 6: Checkpoint-Resume with Clean State
**Mechanism**: Periodically checkpoint the entire task state to a structured summary, then start fresh sessions with only the checkpoint (no raw history). Like saving a game — you don't replay all prior moves.

**For us**: Already partially implemented via the project file's "Current State" section. Could be made more aggressive: every N iterations, have the reviewer write a comprehensive checkpoint summary, then delete/archive all iteration blocks.

## Concrete Recommendations (Ordered by Impact/Effort)

### 1. Topic-Structured Summary Instead of Chronological (Medium effort, High impact)
Replace the collapsed iteration summaries with a maintained structured summary:
```markdown
## Progress Summary (auto-maintained)
**Decisions**: ...
**Files modified**: ...  
**Open questions**: ...
**Blockers resolved**: ...
```
Updated by the reviewer each iteration (or by a summarizer step). Worker sees this instead of iteration-by-iteration history. This is what GAM (DD-768) calls "consolidation" — reorganizing by topic rather than by time.

### 2. Aggressive Pruning: Archive to External Files (Low effort, High impact)
When collapsing iterations, write the full blocks to a separate `{project}-archive.md` file instead of keeping one-line summaries in the main file. The main file stays bounded at ~KEEP_RECENT iterations + the structured summary. Worker can request archive content if needed.

### 3. Filter Worker Context to Directives Only (Low effort, Medium impact)
In `buildWorkerPrompt`, instead of including full iteration blocks, extract only:
- Owner's guidance/directive from each recent iteration
- One-line outcome (success/failure + what changed)
- Skip worker reasoning traces entirely

### 4. Cooperative Paging (Medium effort, High impact for very long tasks)
For tasks running 50+ iterations, implement DD-765-style bookmarks:
```markdown
### Iterations 1-10 [archive:p1 — initial setup, schema design, first migration]
### Iterations 11-20 [archive:p2 — API endpoints, auth integration, test failures]
```
Give worker a tool to recall specific pages. But this requires tool integration — probably only worth it if we see tasks regularly exceeding 20 iterations.

### 5. Periodic Hard Checkpoints (Medium effort, High impact)
Every 10 iterations, have the reviewer produce a "hard checkpoint" — a complete standalone description of current state that doesn't reference any prior iteration. Then archive everything before the checkpoint. The worker starts each iteration seeing only: hard checkpoint + last 3 iterations.

## What Other Frameworks Do

- **AutoGen**: Uses a `TransformMessages` pipeline — you can compose truncation, summarization, and token-limit transforms. Common pattern: keep first message + last N messages + summarize middle.
- **LangGraph**: Checkpoint-based — each node execution is checkpointed, and you can resume from any point. Context is per-node, not accumulated globally.  
- **CrewAI**: Short-term (current task) vs long-term (cross-task) memory split. Long-term goes to vector store with RAG retrieval. Prevents accumulation by design.
- **OpenAI Assistants API**: Thread truncation strategy — keeps most recent messages within token budget, oldest messages dropped silently.
- **Claude's tool_use pattern**: No built-in state management — each API call is independent. State accumulation is the caller's problem (which is our problem).

## Bottom Line

Our `persistent-task.ts` already has the right instinct (sliding window + pruning). The gap is:
1. **Collapsed summaries still accumulate linearly** — need periodic hard checkpoints or archive-to-file
2. **Worker gets raw iteration blocks** — should get filtered directives/outcomes only
3. **No topic-structured consolidation** — chronological history is the worst format for long-running tasks

The DD-765 (cooperative paging) finding is the most surprising: **structured bookmarks + on-demand retrieval beats full context**. This means our pruning isn't just a necessary evil — it's actually *better* than keeping everything in the window. We should prune more aggressively, not less.
