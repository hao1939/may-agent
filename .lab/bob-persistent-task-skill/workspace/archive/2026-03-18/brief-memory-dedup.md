# Design Brief: System-Wide Memory Deduplication

## Context
Agents accumulate duplicate knowledge over time.
1. **Redundant Lessons**: Multiple agents learn "Verify paths before reading" and write it to their local `LESSONS.md`.
2. **Redundant Research**: Scout and Amy might save the same paper or insight in different files.
3. **Fragmented Truth**: When a lesson is updated in one place (e.g., "Use `handoff` not `send`"), the old versions persist elsewhere, causing confusion.

## Goal
Implement a **Memory Deduplication System** that:
1. Identifies identical or near-identical content across agents.
2. Promotes common knowledge to `agents/shared/`.
3. Prunes local redundancy safely.

## Principles
- **Safety First (P5)**: Never delete unique context. If in doubt, keep it.
- **Hierarchical Memory (P47)**:
  - `agents/shared/`: Universal truths (proven across N>1 contexts).
  - `agents/<name>/`: Context-specific nuance.
- **Exact before Semantic**: Start with exact string matching (safe). Move to semantic matching (human-in-the-loop) later.

## Specification

### 1. Scope & Targets
Focus on high-leverage structured files first.
- **Priority 1**: `LESSONS.md` (Structured lists). High duplication rate (e.g., "No blind writes").
- **Priority 2**: `knowledge/library/` (Markdown files). Duplicate papers/repos.
- **Priority 3**: `workspace/` (Ephemeral). Low priority (auto-cleaned anyway).

### 2. Detection Mechanism
We will use a **Two-Tier Detection Strategy**:

**Tier A: Exact Hash Match (Automated)**
- **Method**: Compute SHA-256 of normalized text blocks (trimmed whitespace).
- **Action**: If `hash(local_item) == hash(shared_item)`, **DELETE** local item (it is redundant).
- **Target**: `LESSONS.md` entries.

**Tier B: Semantic Cluster (Human-Review)**
- **Method**: Use LLM to compare local items against shared items.
- **Prompt**: "Is Local Item X semantically equivalent to Shared Item Y? If yes, is Local X *better*?"
- **Action**:
  - If Equivalent & Shared is Better: **DELETE** local.
  - If Equivalent & Local is Better: **PROPOSE UPDATE** to shared.
  - If Unique: **KEEP** local.
  - If "Common Pattern" (appears in >2 agents): **PROPOSE PROMOTION** to shared.

### 3. Implementation Plan

#### Phase 1: The `dedup_lessons` Skill (Tech-Lead)
Create a specific skill `agents/shared/skills/dedup-memory/dedup_lessons.ts` that:
1. Reads `agents/shared/LESSONS.md` and parses into a `Set<string>` of normalized items.
2. Reads target agent's `LESSONS.md`.
3. Filters out items present in the Shared Set.
4. Writes back the cleaned list.
5. **Safety**: Creates `LESSONS.md.bak` before writing.

#### Phase 2: The `scan_duplicates` Cron (Coach)
A weekly task for Coach:
1. Read all `LESSONS.md` files.
2. Cluster items using an LLM call ("Group these 50 items into semantic clusters").
3. Identify clusters with size > 2 (e.g., "3 agents say 'Check file size'").
4. Output a **Synthesis Proposal**: "Move these 3 items to Shared Lessons".

### 4. Safety Constraints
1. **Atomic Writes**: Read-Modify-Write must happen in one transaction or use file locking (handled by `edit` tool typically, but batch updates need care).
2. **Context Preservation**: If a lesson has a sub-bullet with unique details, **DO NOT** dedup based on the parent bullet alone. Hash the *entire tree* of the item.
3. **Receipts**: Log every deletion to `.state/memory-dedup.jsonl` with `{agent, deleted_text, matched_shared_text_hash}`.

## Action Items
1. **Tech-Lead**: Implement `dedup_lessons` skill (Phase 1).
2. **Coach**: Add "Memory Dedup" to periodic tasks (Phase 2).
