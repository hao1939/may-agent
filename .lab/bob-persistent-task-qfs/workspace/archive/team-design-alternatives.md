# Team Design Alternatives

**Author**: Bob (Architect)
**Date**: 2026-03-25
**Context**: Reviewing `agents/shared/may-agent-docs/design/agent-teams.md`.

## Executive Summary

The baseline proposal (Directory Separation) is solid but suffers from a maintenance scaling problem: as we add teams, keeping `common-sense.md` and `SOUL.md` synchronized across N variants of "Coder" becomes a manual burden.

**Recommendation**: **Design C (Archetypes)**.
We should treat agents as **Classes** (Archetypes) and **Instances** (Team Members). The filesystem should reflect this inheritance (possibly via symlinks or import directives). This allows the Meta Team to "patch the class" (improve Coder SOUL) and have it propagate to the Acme Team immediately, while still allowing local overrides.

---

## Design A: Flat Namespace with Tags (The "Simpler" Approach)

Instead of moving files into `agents/meta/` and `agents/acme/`, we keep the current flat structure and add metadata.

### Mechanism
- **No Directory Moves**: Keep `agents/coder`, `agents/bob`, etc.
- **Config**: Add `team: "meta"` or `team: ["acme", "beta"]` to `agent.json`.
- **Visibility**: `agents.list()` accepts a context filter. An agent in the "acme" team only sees other "acme" agents and "shared" agents.
- **State**: Session IDs include team prefix `acme_session_123` to partition database views.

### Pros
- **Zero Migration Cost**: No file movements, git history preserved.
- **Flexibility**: An agent can belong to multiple teams (e.g., a shared "Researcher" or "VectorDB-Admin").
- **Tooling**: Existing paths work.

### Cons
- **Cognitive Load**: The `agents/` folder becomes a dump of 50+ directories.
- **Leaky Abstractions**: It’s hard to "ship" a team. Which folders do I zip? I have to parse JSON to know.
- **Conflict**: You can't have two agents named "coder". You'd need `agents/acme-coder` and `agents/meta-coder`. This breaks the "I am Coder" identity.

### Effort: Low (1-2 days)
Mainly updating `agent-loader.ts` and `agents.list()` logic.

---

## Design B: The "Kernel & User-Space" Model (The "Different" Approach)

Reframing the relationship: Meta agents aren't a "team"; they are the **Operating System**. Product agents are **Applications**.

### Mechanism
- **Privilege Rings**:
    - **Ring 0 (Kernel)**: Bob, Coach, Optimizer, May. Have `sudo` access to all files. Can kill sessions.
    - **Ring 3 (User)**: Acme-Coder, Acme-QA. Sandboxed to `agents/acme/`. Cannot see or call Ring 0 agents directly.
- **Interaction**:
    - User agents emit signals (logs, metrics).
    - Kernel agents inspect memory/disk and inject fixes (hot-patching SOULs).
    - **Crucially**: User agents *cannot* `agents.call("bob")`. They rely on the system to intervene.

### Pros
- **Security**: Product agents cannot mess with system architecture.
- **Clarity**: Clear distinction between "The Platform" and "The Tenant".
- **Shipping**: You ship the "Runner" (Ring 0) and the "Config" (Ring 3).

### Cons
- **Disempowerment**: A Product Agent cannot ask for help ("Coach, I'm stuck"). They have to wait for the Coach daemon to notice them.
- **Complexity**: Requires implementing a permission system and robust signaling/interrupt bus.

### Effort: High (2 weeks)
Requires deep changes to `ChatSession`, `manager.ts`, and permissioning logic.

---

## Design C: Archetypes & Instantiation (The "Radical" Approach)

We solve the N-Team maintenance problem by introducing inheritance.

### Mechanism
- **Archetypes Directory**: `agents/_archetypes/coder/` contains the "Master Coder" SOUL and skills.
- **Team Instantiation**: `agents/acme/coder/` contains:
    - `agent.json`: `{"extends": "_archetypes/coder", "overrides": {...}}`
    - `SOUL.md`: Optional. If present, appends to or replaces the Archetype SOUL.
    - `knowledge/`: Project-specific context.
- **Runtime**:
    - When loading `acme/coder`, the loader merges Archetype config + Team config.
    - `SOUL` is concatenated: [Base Principles] + [Team Context].

### Pros
- **Scalable Evolution**: Coach improves `_archetypes/coder/SOUL.md` → All 50 product teams get better instantly.
- **Identity Preservation**: "I am Coder" is consistent across teams.
- **Local Nuance**: Acme team can still add `knowledge/acme-legacy-systems.md` which only their Coder sees.

### Cons
- **Indirection**: "Where is the file?" You read `acme/coder/SOUL.md` and it's empty, but the agent has a huge prompt. Requires `explain-agent` tool.
- **Debugging**: If Acme Coder fails, is it the Archetype's fault or the Override?

### Effort: Medium (1 week)
Requires a smarter `agent-loader.ts` that handles inheritance/merging.

---

## Comparative Analysis

| Feature | Baseline (Directories) | A (Flat/Tags) | B (Kernel/User) | C (Archetypes) |
| :--- | :--- | :--- | :--- | :--- |
| **Isolation** | High | Low | High | High |
| **Maintenance** | Poor (Duplicate SOULs) | Poor (Unique Names) | Medium | **Best (Inheritance)** |
| **Simplicity** | High | High | Low | Medium |
| **Scalability** | Linear (Copy/Paste) | Linear | High | **Exponential** |

## Recommendation

**Adopt Design C (Archetypes) implemented within the Baseline directory structure.**

1.  **Keep the Directory Split**: `agents/meta/` and `agents/acme/` (from the original proposal) is correct for physical organization and shipping.
2.  **Add Inheritance**: Don't copy-paste `SOUL.md`. Use an `extends` property in `agent.json` or simple symlinks for the first version.
3.  **Why**: The "Auto-Evolve" loop (Coach/Optimizer) relies on improving agents. If we have 10 teams, we don't want to optimize 10 Coders separately. We want to optimize *The* Coder, and have 10 teams benefit.

**Next Step**:
Brief Tech-Lead to implement `agent-loader.ts` support for `extends` in `agent.json`.
