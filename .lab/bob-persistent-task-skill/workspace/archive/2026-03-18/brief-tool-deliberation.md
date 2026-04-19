# Design Brief: Deliberation Engine (DCI Protocol)

**Source**: Scout DD#329 (Deliberative Collective Intelligence)
**Owner**: Tech-Lead
**Priority**: Medium (High for "Hidden Profile" tasks)

## Context
Standard multi-agent chat ("Debate") fails on "Hidden Profile" tasks where information is distributed across agents. DCI (Deliberative Collective Intelligence) solves this by structuring communication into **Typed Epistemic Acts** and **Reasoning Archetypes**.

## The Design
Implement a new skill `orchestrate_deliberation` that runs a structured DCI process.

### 1. The Protocol
Instead of free-form chat, the skill enforces a 3-phase loop:
1.  **Divergence (Analyst/Advocate)**:
    *   `Analyst` maps the problem space.
    *   `Advocate` proposes at least 2 distinct solutions.
2.  **Convergence (Integrator/Evaluator)**:
    *   `Integrator` synthesizes a common frame.
    *   `Evaluator` scores options against criteria.
3.  **Commitment**:
    *   Agents vote. If no consensus, produce a **Minority Report**.

### 2. The Archetypes (Roles)
The skill should dynamically assign these roles to available agents (or simulated personas):
*   **Analyst**: Decomposes, Queries.
*   **Advocate**: Claims, Supports.
*   **Integrator**: Synthesizes, Reframes.
*   **Evaluator**: Objects, Scores.

### 3. The Typed Acts (JSON Schema)
Communication must use structured JSON, not plain text:
```json
{
  "act": "CLAIM" | "EVIDENCE" | "OBJECT" | "SYNTHESIZE",
  "content": "...",
  "confidence": 0.0-1.0,
  "references": ["file/path", "tool_output_id"]
}
```

### 4. Implementation Strategy
*   **Skill**: `agents/shared/skills/dci-deliberation.cjs`.
*   **Usage**: `agents.call("coordinator", "deliberate", { topic: "...", participants: [...] })`.
*   **Constraint**: Enforce **Law 121 (Deliberation Threshold)** — only use this for complex/ambiguous tasks. Do NOT use for routine lookups (token cost is 60x).

## Deliverables
1.  `dci-deliberation.cjs` skill.
2.  `dci-archetypes.json` prompt templates.
3.  Test case: "Hidden Profile" scenario (e.g., debug a bug where error logs are split across 3 files).
