# Design: RALPH Loop (Explore-to-Implement Pipeline)

**Status:** Draft
**Owner:** Bob
**Date:** 2026-03-07

## 1. The Problem
We have a "Brain" (Bob, Amy) and "Hands" (Coder, Optimizer), but they are disconnected.
- **Discovery Island**: Amy finds a new tool or Scout researches a library. The finding sits in a markdown file (`insights.md`, `research.md`).
- **Implementation Gap**: To use that finding, a human must read it, decide it's good, and manually prompt May/Coder to "implement X based on Y".
- **Lost Context**: When Coder finally starts, the nuanced "why" from the research phase is often lost.

## 2. What is RALPH?
In our context, RALPH is a **Macro-Pipeline** that bridges the gap between abstract discovery and concrete code.

- **R**esearch (Amy/Scout): Gather raw data, signals, and documentation.
- **A**nalyze (Bob): Filter signal from noise. "Does this align with our philosophy? Is it useful?"
- **L**oop (Bob + Tech Lead): The refinement cycle. Turn a vague "good idea" into a feasible strategy.
- **P**lan (Tech Lead): Convert strategy into a strict technical specification (Spec-First).
- **H**ardcode (Coder + QA): Execute the spec with hard-gated verification (The "Micro-RALPH").

## 3. The Workflow

### Phase 1: Signal to Strategy (R -> A -> L)
*From "I found something" to "We should build this".*

1.  **Trigger**:
    -   Amy detects high-signal item in `insights.md` (e.g., "New MCP server for Notion").
    -   Human tags a topic: `@bob investigate RALPH loop`.
2.  **Research (Amy/Scout)**:
    -   Agent runs deep-dive.
    -   Output: `workspace/research-[topic].md` (Capabilities, API docs, Pros/Cons).
3.  **Analyze (Bob)**:
    -   Bob reviews research against `philosophy.md` and `roadmap.md`.
    -   Decision: **KILL** (Not aligned/Too costly) or **PROMOTE** (Worth building).
    -   Output: `workspace/strategy-[topic].md` (The "Why" and high-level "What").

### Phase 2: Strategy to Spec (L -> P)
*From "We should build this" to "Here is exactly how".*

1.  **Loop/Refine (Bob -> Tech Lead)**:
    -   Bob delegates to **Tech Lead**.
    -   Task: "Draft a technical design for [topic] based on [strategy]".
2.  **Plan (Tech Lead)**:
    -   Tech Lead reads codebase context.
    -   Tech Lead writes `agents/shared/specs/[topic]-design.md`.
    -   **Constraint**: No code yet. Only Markdown.
    -   **Review**: Bob reviews the design for alignment. (The "Loop" continues until Design is Approved).

### Phase 3: Spec to Code (P -> H)
*From "Here is how" to "It works".*

1.  **Handoff**:
    -   Once Design is Approved, the "Hardcode" phase triggers.
2.  **Hardcode (Coder)**:
    -   **Input**: The Approved Design Doc.
    -   **Constraint**: "Micro-RALPH" applies here. Coder cannot finish until tests pass.
    -   **Workflow**: `implement-and-verify` (Coder -> QA -> Fix -> Loop).

## 4. Agent Roles & Adaptation

| Role | Agent | Responsibility | New Capabilities Needed |
| :--- | :--- | :--- | :--- |
| **R**esearch | **Amy** / **Scout** | Broad scan & Deep dive | Structured Research Output format. |
| **A**nalyze | **Bob** | Gatekeeper (Go/No-Go) | Ability to trigger Tech Lead. |
| **L**oop | **Bob** + **Tech Lead** | Design iteration | Review-and-Reject workflow for designs. |
| **P**lan | **Tech Lead** | Technical Architecture | *Agent newly designed.* |
| **H**ardcode | **Coder** | Implementation | **Hard-Gated Mode** (Test-Driven Exit). |

## 5. Implementation Plan

### Step 1: Formalize the "Hardcode" Loop (Micro-RALPH)
This is the foundation. We need a workflow that enforces verification.
- **Action**: Create `workflows/hardcoded-implementation.ts`.
- **Logic**:
    1.  Coder writes code.
    2.  QA runs *mandatory* verification (lint/test).
    3.  If Fail -> Loop back to Coder with error.
    4.  If Pass -> Commit.
    5.  **Hard Gate**: The workflow *fails* if verification never passes (after N retries). It does not "do its best".

### Step 2: The "Research Brief" Standard
Standardize how knowledge moves from R to P.
- **Action**: Define `templates/research-brief.md`.
- **Why**: Coder needs context, but not 50 pages of raw logs. Bob must synthesize Research into a Brief.

### Step 3: The Pipeline Trigger
How do we connect the phases?
- **Manual Handoff (MVP)**:
    -   Bob writes Strategy.
    -   Human approves.
    -   Human triggers Tech Lead.
- **Automated Handoff (Future)**:
    -   Bob has a tool `delegate_to_tech_lead(strategy_path)`.

## 6. Cost/Benefit Analysis

### Costs
- **Latency**: It's slower. R->A->L->P->H takes much longer than "Just code it".
- **Token Cost**: Multiple agents reading/writing/reviewing.
- **Complexity**: Managing handoffs and state between 4 agents.

### Benefits
- **Alignment**: The "Why" is preserved from Bob to Coder.
- **Quality**: The "Plan" phase prevents "coding yourself into a corner".
- **Autonomy**: Allows us to say "Look into X and implement it if it's good" — a true autonomous goal.

### Verdict
**Worth it for "Feature" level work.**
**Overkill for "Task" level work.**
We should implement RALPH as a **Heavy Workflow** for significant features (e.g., "Add a new MCP server", "Refactor the memory system"), but keep the fast path for "Fix this bug".
