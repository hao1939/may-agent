# Agent Evaluation Criteria

This document defines role-specific evaluation criteria. The evaluator uses these IN ADDITION to the base evaluation rubric (did it follow instructions? did it crash?).

## How to Use
1. Identify the **Role** of the agent being evaluated (see `agents/shared/team.md`).
2. Apply the **Core Metrics** for that role.
3. Assess the **Capability Level** (L1/L2/L3) based on observed behavior.

---

## Role: Builder
**Agents**: Coder, Tech Lead, Master

### Core Metrics
1. **Code Correctness**: Does the code actually work? Did it pass tests?
2. **Test Coverage**: Did the agent add or update tests to verify the change?
3. **Side-Effect Safety**: Did the change break unrelated parts of the system?
4. **Efficiency**: Did it solve the problem in a direct way, or try random changes?

### Capability Levels
- **L1 (Junior)**: Follows instructions, writes code that runs. Needs explicit guidance on edge cases.
- **L2 (Senior)**: Anticipates edge cases, adds tests proactively, refactors for clarity.
- **L3 (Staff)**: Architecturally sound. Optimizes for maintainability and performance. Catching subtle bugs before running code.

---

## Role: Supervisor
**Agents**: May, Manager

### Core Metrics
1. **Decomposition Quality**: Did it break the task into clear, actionable sub-tasks?
2. **Resource Efficiency**: Did it pick the right agent for the job? (e.g., Coder for code, not itself).
3. **Dead-End Detection**: Did it recognize when a path was failing and pivot?
4. **Context Management**: Did it provide sub-agents with enough context to succeed without overwhelming them?

### Capability Levels
- **L1 (Coordinator)**: Routes tasks correctly. Reports status.
- **L2 (Manager)**: Unblocks stuck agents. Optimizes parallel work. Clarifies ambiguous requirements.
- **L3 (Director)**: Strategic planning.Identifies systemic issues. Improves the team's process.

---

## Role: Researcher
**Agents**: Scout, Amy, Amy-Kimi

### Core Metrics
1. **Insight Density**: Is the output information-rich or just verbose?
2. **Source Variety**: Did it consult multiple sources/perspectives?
3. **Verification Rigor**: Did it cross-check claims against facts or code?
4. **Synthesis**: Did it connect dots between disparate pieces of information?

### Capability Levels
- **L1 (Analyst)**: Finds data. Summarizes clearly.
- **L2 (Investigator)**: Validates data. Finds root causes. Connects related concepts.
- **L3 (Scholar)**: Generates new insights. Builds compounding knowledge. Identifies gaps in current understanding.

---

## Role: Philosopher/Architect
**Agents**: Bob, Coach

### Core Metrics
1. **Alignment**: Is the output consistent with `SOUL.md` and `agents/shared/philosophy.md`?
2. **Principle Extraction**: Can it distill complex situations into simple principles?
3. **System Thinking**: Does it consider second-order effects of changes?
4. **Clarity**: Is the communication precise, direct, and structural?

### Capability Levels
- **L1 (Steward)**: Upholds existing rules. Spots obvious violations.
- **L2 (Designer)**: Proposes valid improvements. Resolves conflicts in principles.
- **L3 (Visionary)**: Anticipates system drift. Designs self-correcting mechanisms. Evolves the philosophy.

---

## General Evaluation Flags
*Apply to all roles*

- **[HALLUCINATION]**: Inventing files, functions, or facts that don't exist.
- **[LOOPING]**: Repeating the same failed action more than once.
- **[LAZY]**: Asking the user for information it could have found itself.
- **[BLIND]**: Editing files without reading them first.
- **[SILENT_FAIL]**: Failing without reporting the error code/reason.
