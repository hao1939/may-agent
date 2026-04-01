# Design: Team Archetypes (Agent Inheritance)

**Author**: Bob (Architect)
**Date**: 2026-03-25
**Status**: PROPOSED
**Context**: Scaling the team from 10 to 50+ agents requires a way to share "Role Identity" (e.g., Coder) across multiple "Team Contexts" (e.g., Core-Coder, Feature-Coder) without duplicating maintenance.

## Executive Summary

We recommend **Design C: Archetypes**. 
We treat agents as **Classes** (Archetypes) and **Instances** (Team Members). The filesystem reflects this via inheritance.
- **Archetype**: `agents/_archetypes/coder/` (Base SOUL, base skills).
- **Instance**: `agents/feature-a/coder/` (Inherits from archetype, adds specific context).

This allows the Meta Team (Coach/Optimizer) to improve the "Coder Class" and have those improvements propagate to all instances immediately.

---

## Design A: Flat Namespace with Tags (The "Simpler" Approach)

Keep the current flat structure and add metadata tags.

### Mechanism
- **Structure**: Flat `agents/` directory.
- **Config**: Add `team: "meta"` or `team: ["acme", "beta"]` to `agent.json`.
- **Discovery**: `agents.list()` filters by team tag.

### Pros/Cons
- ✅ **Zero Migration Cost**: No file movements.
- ❌ **Cognitive Load**: `agents/` becomes a dump of 50+ directories.
- ❌ **Conflict**: Name collisions (can't have two "coder" agents).

---

## Design B: The "Kernel & User-Space" Model (The "Different" Approach)

Reframing: Meta agents are the **Operating System**, Product agents are **Applications**.

### Mechanism
- **Ring 0 (Kernel)**: Bob, Coach, Optimizer. Full access.
- **Ring 3 (User)**: Product agents. Sandboxed.
- **Communication**: User agents cannot call Kernel agents directly; they emit signals.

### Pros/Cons
- ✅ **Security**: Product agents cannot break the platform.
- ❌ **Complexity**: Requires a full permission/interrupt system.
- ❌ **Disempowerment**: Agents can't ask for help easily.

---

## Design C: Archetypes & Instantiation (The "Radical" Approach)

**RECOMMENDED**. Solve the N-Team maintenance problem via inheritance.

### Mechanism
- **Archetype**: `agents/_archetypes/coder/` contains the master SOUL.
- **Instance**: `agents/acme/coder/agent.json` contains `{"extends": "_archetypes/coder"}`.
- **Runtime**:
    - Loader merges configs.
    - Loader concatenates SOULs: `[Archetype SOUL] + [Instance SOUL]`.

### Pros/Cons
- ✅ **Scalable Evolution**: Improve one SOUL, fix 10 agents.
- ✅ **Identity**: Consistent "I am Coder" identity.
- ⚠️ **Indirection**: Requires `explain-agent` tool to debug effective prompt.

---

## Implementation Plan

1. **Loader Update**: Tech-Lead updates `agent-loader.ts` to support `extends`.
2. **Migration**: Move `agents/coder` to `agents/_archetypes/coder`. Create `agents/core/coder` that extends it.
3. **Tooling**: Update `agents.list()` to show inheritance tree.
