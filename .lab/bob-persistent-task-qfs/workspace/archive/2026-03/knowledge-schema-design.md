# Design: Cross-Agent Knowledge Schema (Tiered Context)

## Status: Draft
**Date**: 2026-03-09

## Problem
Currently, our agents load *all* files in their `knowledge/` directory at startup. As knowledge grows, this causes:
1.  **Context Bloat**: Wasting tokens on irrelevant information.
2.  **Needle-in-Haystack**: Critical instructions get lost in the noise.
3.  **Cost**: Every session start pays the full tax.

## The OpenClaw Pattern (Reference)
OC uses a 3-tier schema to manage context density (P41: Memory Quality > Model Size).

| Tier | Definition | Loading Strategy | Content Examples |
|------|------------|------------------|------------------|
| **Hot** | Critical Identity & Rules | **Always Injected** | `domain.md` (Mission), `lessons.md` (Corrections), `tools.md` (Signatures) |
| **Warm** | Reference Material | **Lazy Loaded** | `API Reference`, `Style Guide`, `Architecture Specs` |
| **Cold** | Archive & Logs | **Search Only** | `past-failures/`, `daily-briefs/`, `old-decisions/` |

## Proposed Schema for Our System

We will adopt a simplified version of this schema.

### 1. Hot Knowledge (The "soul")
*Files that define *who* the agent is and *how* it must behave.*
- **Location**: `knowledge/*.md` (root of knowledge dir).
- **Behavior**: The Launcher/Manager concatenates these into the System Prompt.
- **Files**:
  - `domain.md`: Role, Mission, Scope.
  - `lessons.md`: Critical corrections and anti-patterns.
  - `tools.md`: Tool definitions (signatures only).

### 2. Warm Knowledge (The "library")
*Files the agent *might* need, but not always.*
- **Location**: `knowledge/library/*.md` (new directory).
- **Behavior**:
  - NOT loaded automatically.
  - The System Prompt includes an index: "Additional reference material available in `knowledge/library/`: [list of files]."
  - Agent uses `read` tool to access them on demand.
- **Candidates**:
  - `agents/coder/knowledge/library/testing-guide.md`
  - `agents/scout/knowledge/library/research-sources.md`

### 3. Cold Knowledge (The "archive")
*Static records.*
- **Location**: `knowledge/archive/` or `workspace/archive/`.
- **Behavior**: Invisible unless searched via `exec find/grep`.

## Implementation Plan

1.  **Standardization**: Update `agents/CONVENTIONS.md` to define this schema.
2.  **Migration**:
    - Create `knowledge/library/` for all agents.
    - Move non-critical docs (e.g., long lists of examples, verbose guides) from root `knowledge/` to `knowledge/library/`.
    - Update `domain.md` to mention the library.
3.  **Tooling Support**:
    - Update `src/manager.ts` (`resolveSystemPrompt`) to *only* load `knowledge/*.md` (non-recursive) and generate a list of `knowledge/library/*` files to append as a footer: "Available References: ..."

## Impact
- **Coder**: Moves heavy language specs to library.
- **May**: Moves heavy process docs to library.
- **Bob**: Moves raw research notes to library.

## Recommendation
Implement "Phase 1: Structure" immediately (create directories, move files). Implement "Phase 2: Tooling" (manager update) in the next cycle.
