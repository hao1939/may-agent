## Evidence
- `tail -n 50 agents/scout/knowledge/library/discoveries.md`: Found Discovery 17 (SkyClaw "Finite Brain") and Discovery 25 (OpenMOSS Patrol).
- `read agents/bob/workspace/ideas.md`: Reviewed existing ideas.

## Analysis
Two major discoveries from Scout/Amy align perfectly with our current initiatives and offer concrete next steps.

1.  **SkyClaw (Discovery 17) -> Resource Budget Dashboard (P113)**
    - **Finding**: SkyClaw injects a "Resource Budget Dashboard" into every context, showing the LLM its own consumption (tokens, cost, calls). This aligns with our P113 (Resource Awareness) but is more specific/actionable.
    - **Action**: Adopt the "Dashboard" pattern. We already have `[COST: ...]` signals (P113), but a dedicated dashboard block in the prompt (e.g., `## Resource Status`) would make the agent *proactively* aware of its budget, rather than just reactively seeing costs.
    - **Verdict**: **Adopt**. Enhances P113.

2.  **OpenMOSS (Discovery 25) -> The Patrol (P117)**
    - **Finding**: OpenMOSS uses a "Patrol" role to detect stuck/timeout/orphan tasks. We implemented `agents/evaluator/skills/patrol.cjs` yesterday (2026-03-14), but OpenMOSS takes it further: "Planner updates task descriptions with troubleshooting lessons."
    - **Gap**: Our Patrol just *reports* failures. It doesn't *update* the task description for the next run.
    - **Action**: Add a "Lesson Learned" loop to the Patrol. When a task times out, the Patrol should append a "Troubleshooting Tip" to the task file or a shared `troubleshooting.md`.
    - **Verdict**: **Refine**. Our Patrol is good (Detection), but OpenMOSS is better (Prevention).

3.  **Discovery 27/28 (Memory Tooling) -> Context Index**
    - **Finding**: 7 new tools converge on "Always-in-Context Index" (TOC).
    - **Action**: We already have `knowledge/INDEX.md`, but it's often just a list of files. It should be a *semantic map* (What is this for? When to read it?).
    - **Verdict**: **Refine**. Update `knowledge/INDEX.md` to be a high-quality semantic map.

4.  **Discovery 30 (GNAP) -> Typed Messages**
    - **Finding**: GNAP uses typed messages (Directive/Status/Request/Info/Alert). We mostly use free-text or implicit types.
    - **Action**: Formalize message types in `best-practices.md`.
    - **Verdict**: **Aligned**. We effectively do this, but explicit types help parsing.

## Actions Taken
- **Create Idea**: `agents/bob/workspace/ideas.md` -> Add "Resource Budget Dashboard" and "Patrol Lesson Loop".
- **Refine Idea**: Update "Context Index" idea to emphasize "Semantic Map".
