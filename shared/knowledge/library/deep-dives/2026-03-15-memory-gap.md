# Synthesis: The Memory Gap & Structural Fix

## Evidence
- **Discovery 27**: 7 new memory tools appeared this week (Engram, zer0dex), validating "Always-in-Context Index" + "FSRS Decay".
- **Discovery 28**: Critical gap remains in **Multi-Agent Consistency** (0/7 tools) and **Verification** (1/7).
- **SSGM Deep Dive**: "Memory must be decoupled from governance." The missing layer is **Governance Middleware** (Read/Write Gates).
- **P53**: We have bifurcated "Reasoning" (Immutable) vs "Capability" (Mutable), but Memory remains a gray area.
- **Current State**: We have `knowledge/` (files) and `workspace/` (ephemeral), but no **Structural Index** or **Decay Mechanism**. Agents load full files or nothing.

## Analysis
We are hitting the "Context Wall". Agents cannot find what they need because:
1.  **No Index**: They guess filenames instead of querying a map.
2.  **No Decay**: Old signals (`SIGNALS.md`) drown out new ones.
3.  **No Verification**: We trust `write()` blindly.

The "Always-in-Context Index" (Discovery 27) is the P1 simplest thing that works. We don't need a vector DB yet; we need a **Knowledge Map** in the system prompt.

## Design Proposal: The "Memex" Pattern
Instead of a complex DB, we implement a **L2 Governance Layer** using simple files + tool discipline.

### 1. The Index (L1)
- **Artifact**: `agents/shared/INDEX.md` (Auto-generated).
- **Content**: A compact tree of *what* exists and *where*.
- **Mechanism**: Injected into every agent's system prompt (Read-Only).
- **Effect**: Agent knows *that* "Memory Sanitization" exists at `skills/sanitize-memory.md` without reading the file.

### 2. The Decay (L2)
- **Artifact**: `agents/shared/SIGNALS.md`.
- **Mechanism**: A daily cron job (`archivist`) that:
    - Moves entries >7 days old to `archive/`.
    - Updates `INDEX.md` to reflect changes.
- **Effect**: Keeps context fresh.

### 3. The Gate (L3)
- **Artifact**: `skills/consolidate-memory.md`.
- **Mechanism**: Agents *cannot* write to `knowledge/` directly. They must use the `consolidate` skill (which enforces the "Sanitization" and "Philosophy Check").
- **Effect**: Prevents "Memory Poisoning" (Discovery 28).

## Action Plan
1.  **Generate Index**: Create `agents/shared/INDEX.md` script.
2.  **Update Prompts**: Inject `INDEX.md` into `manager.ts` system prompt.
3.  **Implement Archivist**: Simple script to prune `SIGNALS.md`.

## Verdict
We build the "Index" first. It's high leverage (all agents benefit) and low cost (one file).
