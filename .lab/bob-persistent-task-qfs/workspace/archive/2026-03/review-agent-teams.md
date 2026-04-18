# Review: Agent Teams Architecture

**Status**: Review Complete
**Reviewer**: Bob (Architect)
**Target**: `agents/shared/may-agent-docs/design/agent-teams.md`

## Executive Summary
**Verdict: Conditional Approval**
The distinction between "Meta" (System Builders) and "Product" (System Users) is architecturally sound and necessary for scaling. However, the proposed directory structure (`agents/meta/` vs `agents/acme/`) creates two significant risks:
1.  **Loss of Universal Inheritance**: By burying `shared/` inside `meta/`, we deny Product teams access to global wisdom (Philosophy, Universal Common Sense).
2.  **Migration Instability**: Moving core agents to `agents/meta/` invalidates thousands of absolute path references in existing prompts, tools, and scripts.

## Architectural Critique

### 1. The "Global" Void (Inheritance Model)
The proposal suggests:
```text
agents/
  meta/shared/  (Meta common sense)
  acme/shared/  (Acme common sense)
```
**Problem**: This implies `acme` starts with zero knowledge. It loses access to `agents/shared/philosophy.md` (Simplest Thing, Evidence First), `agents/shared/skills/` (generic skills like "safe-read"), and `agents/shared/common-sense.md`.
**Fix**: Maintain a top-level `agents/shared/` for **Universal** truth.
```text
agents/
  shared/       (Universal: Philosophy, Base Skills, Base Common Sense)
  meta/
    shared/     (Meta-Specific: "Check Gym", "Deploy Protocols")
  acme/
    shared/     (Product-Specific: "Run Tests", "Business Logic")
```
Agents should load *both*: Universal + Team-Specific context.

### 2. The Migration Cliff (Pathing)
Moving `agents/bob/` to `agents/meta/bob/` is a destructive change.
- **Risk**: Every tool call referencing `agents/bob/workspace`, every internal link in `knowledge/`, and every hardcoded path in `handlers/` will break.
- **Mitigation**:
    - **Option A (Symlinks)**: Keep physical location as is, use symlinks for logical grouping.
    - **Option B (Config-Driven)**: Define teams in `agents.json` or a mapping file, rather than enforcing directory nesting.
    - **Option C (Accept the Pain)**: If we move, we must run a massive `sed` across the entire codebase first.

### 3. The "Headless" Product Team
The doc places `may` (the coordinator agent) in `agents/meta/`.
- **Scenario**: We ship the "Slim Binary" with just `agents/acme/`.
- **Gap**: Who answers the user? If `may` is missing, is there a default entry point?
- **Recommendation**: The "Orchestrator" capability should be a runtime feature or a lightweight "default agent" present in *every* team (or inherited from Universal).

## Answers to Specific Questions

### Q1: Does the team/meta separation make architectural sense?
**Yes.** It correctly models the "Toolmaker vs Tool User" relationship. It prevents Product agents from corrupting System primitives.

### Q2: Any gaps in the cross-team access model?
**Yes, logical inheritance.**
The filesystem access is fine (Meta can read Acme). The gap is in **Knowledge Propagation**.
- If Coach learns "Always check file size" (Universal Lesson), how does that get to Acme?
- If it's saved to `agents/meta/coach/knowledge/`, Acme never sees it.
- **Fix**: Coach must promote universal lessons to `agents/shared/LESSONS.md` (Top Level), which Acme can read. The architecture must explicitly support "Upstream Promotion" of knowledge.

## Recommendations

1.  **Adopt a 3-Layer Hierarchy**: `Universal` (Global) > `Meta` (System) / `Product` (Team).
2.  **Don't Move Files Yet**: Implement "Teams" as a logical grouping in `agent-loader.ts` first (e.g., `agents/bob/agent.json` gets `"team": "meta"`). Test the isolation logic before moving directories.
3.  **Define the "Slim Binary" Entry Point**: Explicitly state which agent handles `manager.run` in a product-only deployment.
