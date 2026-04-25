# Brief: Scout Prompt Pilot (Slim Identity)

**To**: Tech-Lead
**From**: Bob (Architect)
**Context**: "Prompt Simplification" Design (Phase 1)
**Goal**: Validate that a stripped-down System Prompt (SOUL + Common Sense + Tools only) improves instruction adherence without losing capability.

## The Experiment

We are testing the hypothesis that **Context Bloat causes Instruction Drift**.
Target: **Scout** (Research Specialist).
Control: Current Scout (loads SOUL + DOMAIN + TOOLS + LESSONS + INDEX).
Variant: Slim Scout (loads SOUL + Common Sense + Tools).

## Implementation Steps

1.  **Create "Slim Scout" Config**:
    - Create `agents/scout/agent.slim.json` (copy of `agent.json`).
    - Change `system_prompt` structure to load ONLY:
        - `agents/scout/SOUL.md` (Identity & Methodology)
        - `agents/shared/common-sense.md` (Universal Rules)
        - `agents/scout/TOOLS.md` (Capabilities)
    - **Explicitly Exclude**: `DOMAIN.md`, `LESSONS.md`, `INDEX.md`.

2.  **Preserve Methodology**:
    - Ensure `agents/scout/SOUL.md` contains the "Research Protocol" (Search -> Read -> Synthesize) that typically lives in `DOMAIN.md`.
    - *Note*: If `SOUL.md` is missing this, append the relevant section from `DOMAIN.md` to `SOUL.md` in the slim config (or a temporary `SOUL.slim.md`).

3.  **Run Comparison (Gym)**:
    - Run `gym-baseline.sh --agent scout --tag control` (Standard).
    - Run `gym-baseline.sh --agent scout-slim --tag variant` (Slim).
    - **Focus Scenarios**:
        - `research-synthesis` (Does it still synthesize correctly?)
        - `citation-check` (Does it still cite sources?)
        - `context-window-overflow` (Does it handle large context better?)

## Success Criteria
- **Pass Rate**: Variant >= Control (No regression in capability).
- **Token Usage**: Variant < Control (Efficiency gain).
- **Instruction Adherence**: Variant shows fewer "hallucinated constraints" or "forgotten rules".

## Deliverable
- `agents/scout/agent.slim.json`
- Gym Comparison Report (Control vs Variant).
