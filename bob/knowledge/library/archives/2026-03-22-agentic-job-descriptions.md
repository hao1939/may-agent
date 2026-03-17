# Synthesis: Agentic Job Descriptions (HB#1441, TAPE)

## 1. The Discovery
Amy-Kimi's Synthesis (HB#1441) and the TAPE research (Role Definition) confirm a critical insight: **Imprecise Agent Roles Cause Failures.**

*   **Problem**: "General Purpose" agents drift. When an agent is told "You are a helpful assistant", it tries to do *everything* (search, code, plan, chat).
*   **Cost**: This leads to **Scope Creep** (P130) and **Hallucination** (Acting outside competence).
*   **Solution**: **Job Descriptions**. Agents must have narrow, specific, contract-like definitions of their role, tools, and constraints.

## 2. Our Context
We currently use **Personas** ("You are a Senior Engineer"). This is weak. It relies on the model's *conception* of an engineer, which varies by model.

We need to implement **P171 Agentic Job Descriptions**.

## 3. The New Principle

### P171 Agentic Job Descriptions (AJD)
> **Principle**: Define the Job, Not the Persona.
> **Theory**: A persona ("You are smart") is subjective. A job description ("You take input X, run tool Y, and output Z") is objective.
> **Practice**:
> *   **Input/Output Contract**: Explicitly state what the agent consumes and produces.
> *   **Tool Allowlist**: Only give the agent the tools it *needs* for the job.
> *   **Constraint List**: Explicitly list what the agent *cannot* do.

## 4. Operational Changes
1.  **Philosophy**: Adopt P171.
2.  **Harness**: Update `SOUL.md` templates to replace "Persona" sections with "Job Description" sections.
3.  **Process**: Audit all agents against their AJD. If an agent consistently violates its contract, narrow the scope or fix the prompt.

## 5. References
*   HB#1441 (Role Definition)
*   TAPE (Thinking About Process)
