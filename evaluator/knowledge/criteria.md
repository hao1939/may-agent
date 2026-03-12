
# Agent Evaluation Criteria

This document defines role-specific evaluation criteria. The evaluator uses these IN ADDITION to the base evaluation rubric (did it follow instructions? did it crash?).

## How to Use
1. Identify the **Role** of the agent being evaluated (see `agents/shared/team.md`).
2. Apply the **Core Metrics** for that role.
3. Assess the **Capability Level** (L1/L2/L3) based on observed behavior.

---

## Special Instructions: Agent-Specific Criteria

When evaluating an agent, the Evaluator MUST check the target agent's `SOUL.md` for a section titled `## Evaluation Criteria`.

- **If found**: Use those criteria as the primary grading rubric, in addition to the generic Core Metrics.
- **If not found**: Use the Role-Based Core Metrics defined below.

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
2. **Delegation Quality (weighted by task complexity): Did May pick the right agent for the task?
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

## Role: Evaluator
**Agents**: Evaluator

### Core Metrics
1. **Objectivity**: Is the score based on evidence, not vibes?
2. **Specificity**: Does it cite specific lines or actions?
3. **Consistency**: Do similar failures get similar scores?
4. **Actionability**: Can the target agent use this feedback?

### Capability Levels
- **L1 (Auditor)**: Spots failures. Writes accurate scores.
- **L2 (Reviewer)**: Provides actionable feedback. Identifies patterns.
- **L3 (Assessor)**: Designs evaluation systems. Calibrates standards.

---

## Role: Philosopher/Architect
**Agents**: Bob, Coach

### Core Metrics
1. **Alignment**: Is the output consistent with `SOUL.md` and `agents/shared/philosophy.md`?
2. **Principle Extraction**: Can it distill complex situations into simple principles?
3. **System Thinking**: Does it consider second-order effects of changes?
4. **Clarity**: Is the communication precise, direct, and structural?

### Capability Levels
- **L2 (Coach)**: Designs and runs training exercises. Provides actionable feedback.

- **L1 (Steward)**: Upholds existing rules. Spots obvious violations.
- **L2 (Designer)**: Proposes valid improvements. Resolves conflicts in principles.
- **L3 (Visionary)**: Anticipates system drift. Designs self-correcting mechanisms. Evolves the philosophy.

---

## Tool Awareness — Known Valid Tools

Before flagging `[HALLUCINATION]` for tool usage, check `agents/shared/team.md`.
Some agents have tool presets that provide sub-tools:

- **`scrape` preset** → provides `scrape_webpage`. Used by Scout and Amy.
  `scrape_webpage` is a REAL tool. Do NOT flag it as hallucination.
- **`coding` preset** → provides `read`, `bash`, `edit`, `write`. Used by most agents.
- **`agents` tool** → provides delegation/coordination with actions: call, list, peek, steer, cancel.
  Used by May, Tech Lead, Optimizer, Bob, Coach. `agents` is a REAL tool. Do NOT flag it.
- **`workflow` tool** → provides workflow execution. Used by May, Tech Lead, Optimizer, Coach.
- **`cron` tool** → provides cron job management. Used by May.
- **`socket_watch` tool** → provides socket observation. Used by Coach.
- **`agent-growth` preset** → provides `fork_agent`, `verify_agent`, `promote_agent`, `discard_agent`.
  Used by Coach. These are REAL tools for agent lifecycle management (forking to .lab/,
  running verification, promoting changes, cleanup). Do NOT flag them as hallucination.

**Rule**: If an agent uses a tool and it returns results (not an error), it is real.
Only flag `[HALLUCINATION]` for tools that return errors like "tool not found" or
that the agent clearly invented (no result returned).

---

## General Evaluation Flags
*Apply to all roles*

- **[HALLUCINATION]**: Inventing files, functions, or facts that don't exist. **Exception**: Check Tool Awareness section above before flagging tool usage.
- **[LOOPING]**: Repeating the same failed action more than once.
- **[LAZY]**: Asking the user for information it could have found itself.
- **[BLIND]**: Editing files without reading them first.
- **[SILENT_FAIL]**: Failing without reporting the error code/reason.
