# Review: Agent Evaluation Framework Upgrade

## Status: APPROVED

I have reviewed the design for upgrading our Agent Evaluation Framework based on learnings from OpenClaw (OC). The proposal to shift from generic rubrics to **role-specific capability targeting** is structurally sound and aligns with our "Agent as Feature Unit" philosophy (P15).

## Verdict
**APPROVED.** The move to role-specific evaluation is the correct evolution step.
- **Why**: Generic evaluation ("did it follow instructions?") is too low-bar for specialized agents. A coder should be graded on code quality and test coverage. A supervisor should be graded on delegation clarity and resource management. A researcher should be graded on insight density.
- **Why Now**: We have diverse agents (Coder, May, Scout, Bob) but a one-size-fits-all evaluator. This mismatch creates noise in our quality signals.

## Key Changes to Implement

### 1. Per-Agent Evaluation Profiles
Instead of a single `evaluator/knowledge/rubric.md`, we will have role-based criteria.

| Role | Agent(s) | Key Metrics |
|------|----------|-------------|
| **Builder** | Coder | Code Correctness, Test Coverage, Side-Effect Safety |
| **Supervisor** | May | Decomposition Quality, Resource Efficiency, Dead-End Detection |
| **Researcher** | Scout | Insight Density, Source Variety, Verification rigor |
| **Philosopher** | Bob | Alignment with SOUL.md, Principle Extraction Accuracy |

### 2. Capability Levels (L1/L2/L3)
Adopt the OC pattern of graded capability levels to track maturity.
- **L1 (Basic)**: Follows instructions, no gross errors.
- **L2 (Independent)**: Handles edge cases, self-corrects, manages own context.
- **L3 (Expert)**: Proactive optimization, invents new patterns, mentors others.

*Note: For V1 implementation, we will stick to a simpler "Pass/Fail/Excelling" model to avoid over-engineering, but structure the feedback to support L-levels later.*

### 3. Structural Integration
- **Where**: `agents/evaluator/knowledge/criteria.md` (new file).
- **How**: The evaluator reads the target agent's role from `agents/shared/team.md` or infers it, then selects the matching criteria section.

## Implementation Plan

1. **Create `agents/evaluator/knowledge/criteria.md`**
   - Define specific questions for each role (Builder, Supervisor, Researcher, Philosopher).
   - Import the \"Key Metrics\" from the table above.

2. **Update `agents/evaluator/knowledge/domain.md`**
   - Instruct the evaluator to load `criteria.md`.
   - Instruct it to identify the role of the agent being evaluated.
   - Instruct it to use the role-specific questions *in addition* to the base rubric.

## Recommendation
**Proceed with implementation immediately.** This is a high-leverage change that improves the signal-to-noise ratio of our entire meta-loop.
