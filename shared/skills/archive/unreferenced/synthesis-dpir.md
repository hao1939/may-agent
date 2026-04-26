# Skill: Synthesis Protocol (DPIR)

**Status**: Adopted
**Source**: Scout CR#176 (Agent-as-Synthesizer), Mechanism 79

## Goal
Prevent low-quality outputs on complex synthesis tasks by separating content from form. Instead of generating a large artifact in one shot, agents follow a structured 4-phase loop: **Decouple → Plan → Iterate → Render**.

## When to Use
- Generating files > 100 lines
- Writing complex documentation or design briefs
- Implementing features spanning > 2 files
- Creating synthetic data, test cases, environments (Dockerfiles), or diagrams
- Any task where "reasoning-action mismatch" (FM-2.6) is likely — the agent needs to *think* about what to include before *formatting* the output

## The 4 Phases

### 1. Decouple (The "What")
**Goal**: Isolate the conceptual substance from implementation details. Don't think about formatting yet.
**Action**: Enumerate distinct *concepts*, *requirements*, or *facts* to include as a bulleted list.
**Output**: `workspace/dpir-content.md` (or inline notes if the task is small).
**Why**: Prevents "formatting lock-in" where you obsess over syntax instead of information density.

### 2. Plan (The "Structure")
**Goal**: Create a structural blueprint for the artifact.
**Action**: Generate an outline with empty headers/sections, a storyboard, or pseudo-code.
**Output**: `workspace/dpir-structure.md` (or the target file with placeholder sections).
**Why**: Verifies the "shape" before filling it. Catches structural gaps early. Enables generating N distinct structures for 1 concept (diversity).

### 3. Iterate (The "Quality Loop")
**Goal**: Refine content against constraints using heterogeneous perspectives before final assembly.
**Action**: Critique → Refine loop. Use *different* perspectives (completeness, constraint compliance, redundancy, style).
**Checks**:
- **Completeness**: "Does this cover all requirements from the task?"
- **Constraint compliance**: "Does this fit the target format/conventions?"
- **Redundancy**: "Am I repeating information across sections?"
- **Heterogeneity**: Critics must differ in perspective — don't re-check the same dimension.
**Output**: Refined content and/or adjusted structure.
**Constraint**: Max 2 iterations. If it's not converging, the structure is wrong — go back to Phase 2.

### 4. Render (The "Execution")
**Goal**: Deterministically produce the final artifact.
**Action**: Merge content into structure. Pure execution — no new "thinking" allowed here.
**Output**: The final file at its target path.
**Why**: By this point, both *what* to say and *where* to put it are settled. Rendering is mechanical. This prevents syntax errors and structural drift.

## Scaling Rules

**Small tasks** (< 50 lines, single file): Skip to Render. DPIR overhead isn't justified.

**Medium tasks** (50-150 lines): Decouple + Render. Write a quick content list, then produce the artifact. Skip the formal Plan/Iterate phases.

**Large tasks** (> 150 lines, multi-file): Full DPIR. Each phase should produce a workspace artifact for traceability.

## Benefits
- **Diversity**: Decoupling allows generating N distinct plans for 1 concept.
- **Quality**: Iteration on the *plan* is cheaper than iterating on the *artifact*.
- **Correctness**: Rendering is deterministic, preventing errors in the final output.

## Anti-Patterns
- **One-shot synthesis**: Jumping straight to Render on a complex task. Output will be shallow or structurally incoherent.
- **Infinite iteration**: Looping through Phase 3 more than twice. If it's not converging, the structure is wrong — go back to Phase 2.
- **Phase confusion**: Writing final-quality prose during Decouple. Keep Phase 1 output rough — bullet points, fragments, shorthand. Polish belongs in Phase 4.
