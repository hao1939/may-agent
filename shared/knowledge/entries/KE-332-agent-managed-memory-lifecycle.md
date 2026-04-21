# KE-332: Agent-Managed Memory Lifecycle — Agents Should Control Their Own Memory Operations

**Status**: Theoretical (strong external evidence, untested internally)
**Source**: DD-831 (Agent Learning Mechanisms Survey — Letta/MemGPT analysis)
**Confidence**: High (Letta: 22.2k★, 7463 commits, very active; OS-inspired two-tier memory)
**Created**: 2026-04-22

---

## One-Sentence Summary

Letta/MemGPT demonstrates that agents managing their own memory (deciding when to consolidate, evict, and retrieve) outperform system-managed memory — our agents have context.md (core) and checkpoints (archival) but no self-directed memory operations, creating stale context and missing consolidation.

---

## The Finding

### What Letta Does
Letta (Packer et al., 2023) applies OS virtual memory principles to LLM agents:
1. **Two-tier memory**: Core memory (always in context, ~few KB) + Archival memory (unlimited, retrieved on demand)
2. **Agent-controlled operations**: `core_memory_append`, `core_memory_replace`, `archival_memory_insert`, `archival_memory_search`
3. **Memory editing as tool calls**: Memory mutations are first-class tools, not implicit side effects
4. **Reflection on memory**: Agent reads and rewrites its own persona/context (meta-learning)
5. **Persistence**: State survives between invocations via DB-backed memory

### Our Current State
- `context.md` ≈ core memory (always loaded, ~few KB)
- Checkpoint/state files ≈ archival memory (persisted, retrieved on demand)
- **System-managed**: `finish()` context_updates are the only write path; system decides what goes in context.md
- **No agent-initiated consolidation**: Agent can't say "my context is stale, let me reorganize it"
- **No agent-initiated eviction**: Context grows until human intervention
- **No agent-initiated search**: Agent can't search past checkpoints for relevant experience

### The Gap
Letta's key insight: the agent is the best judge of what it needs to remember. System-managed memory (our current approach) creates two failure modes:
1. **Stale accumulation**: Context.md grows with facts that are no longer relevant
2. **Missing consolidation**: Related learnings across sessions never get unified

### Predicted Impact
- P-831c: Agent-managed memory will produce better context.md quality than system-managed within 20 sessions

### Experiment Design
**EXP-next: Memory Self-Management**
1. Give one agent explicit `memory_consolidate()` and `memory_evict()` tools
2. `memory_consolidate()`: agent rewrites a section of its own context.md, merging related entries
3. `memory_evict()`: agent marks context entries as archival (moved to checkpoint, removed from active context)
4. Compare context.md quality (human-rated) over 50 sessions vs. control agent with current system
5. Secondary measure: does the agent spontaneously use these tools, or does it need prompting?

---

## Connections
- **Extends KE-040** (Memory Architecture Convergence): Letta is the 5th independent system confirming active memory substrate
- **Extends KE-079** (Structure-Aware Retrieval): Agent-managed memory needs retrieval to work
- **Extends KE-052** (Structural Access): Self-managed memory is the ultimate access structure — agent curates its own view
- **Addresses WKWA-004** (Memory Control Loop): Adds the missing agent-initiated write/evict operations
- **Connects to KE-082** (Reasoning Dropout): Stale context may contribute to reasoning quality degradation

---

*From DD#831 Letta/MemGPT analysis. Our two-tier memory architecture exists — the missing piece is agent agency over memory operations.*
