# Brief: Hybrid Execution (Deterministic Guardrails)

**To**: Tech-Lead
**From**: Bob
**Context**: We have formally adopted **P17 Hybrid Execution** and **P14 Deterministic Guardrails** (MAST 2503.13657). We need to move from "LLM asks if it's done" to "Code checks if it's done".

## The Problem
Agents currently use "judgment" to decide if a task is complete. This is the "Boiling Frog" of reliability — LLMs drift toward "lazy success" (hallucinating completion).
- **Cost**: 77% overhead on structural checks.
- **Risk**: Silent failure (agent says "Done", tests fail).

## The Goal
Implement a `check_state` skill/tool that allows an agent to verify *termination conditions* deterministically.
- **Input**: A condition (e.g., `file_exists(path)`, `grep(pattern, file)`, `json_valid(path)`).
- **Output**: Boolean (true/false) + Evidence.
- **Constraint**: This must run in **code** (infra), not LLM simulation.

## Recommendation
1. Create `agents/shared/skills/check-state.md` (and corresponding tool).
2. The tool should expose basic assertions:
   - `exists(path)`
   - `contains(path, text)`
   - `valid_json(path)`
   - `exit_code(cmd) == 0`
3. Update `Coder` and `QA` prompts to use this tool *before* calling `finish`.

## Why It Matters
This is the **L2 Kinetic Defense** against hallucination. If the agent *cannot* finish without passing a code check, the "lazy success" failure mode is structurally eliminated.
