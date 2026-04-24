# Design: Continuous Memory & Learning System

**Status:** Draft
**Related Request:** req:fe5974d6 (Hao)
**Principle:** P26 Evolution over State, P42 Minimalism

## Problem
Agents currently have "Amnesia."
1. **Episodic Memory (Session)** is rich but ephemeral. It dies with the session.
2. **Semantic Memory (Knowledge)** is durable but static. It only updates when a human or "Consolidation Task" manually edits it.
3. **Result:** Agents make the same mistakes repeatedly (e.g., "Looping", "Bad Imports") because the lesson learned in Session A isn't available in Session B.

## Proposal: The Harvest-Consolidate-Prune Loop

We need a mechanical process to move data from Episodic -> Semantic automatically, with a "Poison Filter" to prevent garbage accumulation.

### 1. The Harvest (Fast Loop)
**Trigger:** End of every session (`finish()`).
**Mechanism:** The `finish()` tool already captures `summary`. We need to expand this to capture `lessons_learned`.
**Change:**
- Update `finish()` schema to include optional `lessons`: `[{ category: "fix"|"pattern", content: "..." }]`.
- When an agent finishes, if `lessons` are provided, the system appends them to `agents/shared/memory-stream.jsonl`.
- **Constraint:** Agents must self-reflect. "What did I learn?"

### 2. The Consolidate (Slow Loop)
**Trigger:** Periodic (Daily/Weekly) or Size-based (>50 items in stream).
**Agent:** **Evaluator** (or a new specialized Memory Agent).
**Mechanism:**
1. Read `memory-stream.jsonl`.
2. Cluster lessons by topic (e.g., "File Safety", "React Imports").
3. **Verification Step (The Poison Filter):**
   - Check if the lesson contradicts `philosophy.md` or `common-sense.md`.
   - Check if the lesson is already known (duplicate).
   - Check if the lesson is a hallucination (requires evidence).
4. **Action:**
   - **Update Strategy:** Append to `agents/shared/knowledge/strategies.md` (high confidence).
   - **Update Skill:** If a skill failed X times, flag for "Gym Training" (Growth Cycle).
   - **Discard:** Noise.

### 3. The Prune (Forgetting)
Memory that isn't used is debt.
**Mechanism:**
- Track "Last Access" timestamp for every knowledge file.
- If a file in `knowledge/` hasn't been read in 30 days, move to `knowledge/archive/`.
- Keep the "Working Set" small and relevant.

## Architecture Changes

### A. Infra (Tech-Lead)
1. **Schema Update:** Modify `finish()` tool in `src/lib/tools/lifecycle.ts` to accept `lessons` array.
2. **Persistence:** Ensure `lessons` are written to `.state/memory-stream.jsonl` (new file).

### B. Behavior (Coach)
1. **Training:** Teach agents to use the `lessons` field in `finish()`.
   - *Bad:* "I learned to be careful."
   - *Good:* "Learned that `fs.exists` is deprecated in Node 22; use `fs.stat`."

### C. Logic (Bob/Evaluator)
1. **Consolidator:** Create a generic `consolidate-memory` skill that reads the stream and proposes updates. (We have a manual version; need to automate it).

## Immediate Next Steps (MVP)
1. **Schema:** Ask Tech-Lead to add `lessons` to `finish()`.
2. **Stream:** Start collecting data.
3. **Manual Harvest:** Bob manually runs consolidation once a week (as we do now, but with better data).

## Why This Works
- **Low Friction:** Agents just add a field to their final call.
- **Human-in-the-Loop (Initially):** We can review the `memory-stream.jsonl` before automating the write to `strategies.md`.
- **Structural:** It doesn't rely on agents "remembering to write to a file" — it's part of the `finish` protocol.
