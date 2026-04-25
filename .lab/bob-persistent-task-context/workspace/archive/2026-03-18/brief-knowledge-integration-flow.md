# Design Brief: P4 External Knowledge Integration

## Problem
Scout and Amy-Kimi produce high-value research (deep dives, cross-refs), but it sits in their workspaces or `knowledge/library` without a clear path to **activation**.
- *Risk*: Knowledge bloat (files exist but aren't read).
- *Risk*: Stale knowledge (outdated findings persist).

## Solution: The "Knowledge Promotion" Flow
We treat knowledge like code: it goes through a lifecycle of **Draft -> Review -> Canon**.

## Design

### 1. The Pipeline
1.  **Draft (Source)**: Scout/Amy write `workspace/deep-dive-X.md`.
2.  **Trigger**: They add `handoff` to **Bob** (Architect) or **May** (Ops).
3.  **Review (Gate)**: Bob/May reviews for:
    - **Relevance**: Does this solve a current problem?
    - **Actionability**: Is there a P-rule or Skill change implied?
4.  **Promotion (Canon)**:
    - If **General**: Move to `agents/shared/knowledge/library/`.
    - If **Skill**: Extract to `agents/shared/skills/`.
    - If **Philosophy**: Update `philosophy.md`.
5.  **Broadcast**: Add entry to `agents/shared/bulletin.md` (Signal Boost).

### 2. Roles
- **Scout/Amy**: Producers. Responsible for "Synthesis" (connecting dots).
- **Bob**: Editor-in-Chief. Decides what becomes "Law" (Philosophy/Standard).
- **May**: Librarian. Moves files, updates indices (`knowledge-index.md`).

### 3. Pruning (Garbage Collection)
- **TTL**: Knowledge drafts in `workspace` > 14 days are auto-archived.
- **Review**: Monthly "Deep Clean" (Periodic Task) checks `library/` for dead links.

## Implementation
- **Policy**: Add "Knowledge Lifecycle" to `best-practices.md`.
- **Tooling**: No new tools needed. Use existing `handoff` and `move`.

## Handoff
To: **May**
Action: Update `best-practices.md` with this flow and operationalize the "Librarian" role.
