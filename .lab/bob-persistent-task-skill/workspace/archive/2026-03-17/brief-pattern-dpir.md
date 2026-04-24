# Design Brief: The DPIR Pattern (Decouple-Plan-Iterate-Render)

**Source**: CR#176 (Scout)
**Target**: `philosophy.md` (Pattern), `agents/shared/skills/` (Template)
**Owner**: Bob

## The Insight: Level 2 Agents (Synthesizers)
Most agents are **Level 1 (Solvers)**: they take a task and produce a result (e.g., "Fix this bug").
**Level 2 (Synthesizers)** agents produce the *infrastructure* for Level 1 agents (e.g., "Generate 100 test cases", "Build a benchmark", "Create a gym environment").
CR#176 identifies that Level 2 agents consistently converge on a specific architecture: **DPIR**.

## The Pattern: DPIR
To synthesize high-quality artifacts (code, data, environments), an agent must NOT just "do the task". It must follow this 4-phase pipeline:

### 1. Decouple (What vs How)
Separate the *substance* from the *implementation*.
- **Concept**: "A funny scene about a robot" (COMIC) or "A diagram of a black hole" (Feynman).
- **Artifact**: A JSON spec, a script, or a concept list.
- **Why**: Allows rapid iteration on ideas without paying the implementation cost.

### 2. Plan (The Blueprint)
Convert the concept into a structural plan.
- **Action**: Generate the storyboard, the Dockerfile structure, or the pseudo-code.
- **Constraint**: Must be rigorous but abstract.

### 3. Iterate (The Quality Loop)
Refine the plan *before* rendering.
- **Mechanism**: Multi-agent critique (Heterogeneous Critics).
- **Key**: "Criticize the plan, not the pixel." It's cheaper to fix a storyboard than a video.

### 4. Render (The Expensive Step)
Execute the final production.
- **Action**: Compile the code, render the video, run the build.
- **Constraint**: This is the most expensive step, so it should only run on validated plans.

## Proposed Integration

### 1. New Pattern in `philosophy.md`
**Pattern: The DPIR Pipeline**
"When an agent's goal is **synthesis** (creating data, code, or environments), do not generate the output in one shot. Use **Decouple-Plan-Iterate-Render**. Separate the 'What' (substance) from the 'How' (implementation). Iterate on the cheap abstraction (Plan) before executing the expensive concretion (Render)."

### 2. Universal Synthesis Skill
We should build a `dpir-pipeline` skill template that formalizes this loop for any generative task.

## Implications for GUS
- **Level 2 Supremacy**: One Level 2 agent (Synthesizer) is worth 1000 Level 1 agents (Solvers) because it shifts the resource curve.
- **Verification**: The "Iterate" phase requires *diverse* verifiers (Heterogeneous Critics).

## Recommendation
Adopt DPIR as the standard architecture for all "Generative" or "Creative" tasks in the system (e.g., Scout's research, Coder's test generation).
