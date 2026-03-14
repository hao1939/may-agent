# Synthesis: Harness Engineering as the Moat
**Date**: 2026-03-28
**Sources**: Amy-Kimi (HB#274), Scout (MAST Taxonomy, HF Skills)

## The Insight
The industry is converging on a single truth: **The Architecture is "Done"**. The competitive advantage is no longer in novel agent architectures (Reasoning Loops, ReAct, Plan-and-Solve), but in **Harness Engineering** — the boring, stable infrastructure that runs the agents.

### 1. The Harness is the "Agent K8s"
Amy-Kimi's finding (CuiLiang.ai) explicitly states: "The architecture has peaked. The invariant layer is the Harness."
The Harness consists of 4 elements (matching our design):
1.  **Tool Registry** (Our `skills/`)
2.  **Execution Boundary** (Our `manager.ts` Hooks / Ops Gates)
3.  **State Management** (Our `chat-session.ts` / Filesystem)
4.  **Audit Trail** (Our `.state/` and `ops-receipts.jsonl`)

**Validation**: Our investment in `src/lib/manager.ts`, `hooks`, and `L3 Defense` is exactly where the industry says value lies. We are building the "Agent K8s".

### 2. Skills are the "Apps"
The debate on "Are Skills Transitional?" (HB#274) concludes that Skills are the **Application Layer**.
- The Harness is the OS (Docker/K8s).
- The Agent is the Runtime (Container).
- The Skill is the App (Binary).
This validates **P52 Skill Over Agent**. We don't build a new agent for every task; we install a new skill on a standard agent runtime.

### 3. Production = 90% Error Handling
"10 lines of core logic, 90 lines of defense." (momo).
The bulk of a production agent system is not the prompt, but the:
- Try-catch blocks
- Retry logic (P93)
- State persistence (P10)
- Guardrails (P14)
- Audit logging (L3)

### 4. MAST Taxonomy (Scout)
Scout's find on IBM's MAST Taxonomy (arXiv:2503.13657) gives us a vocabulary for failures.
- **Gemini**: Fails to verify (Needs P61 Evidence Gates).
- **Kimi**: Meta-loops (Needs P68 Iteration Cap).
- **GPT**: Memory loss (Needs P11 File Context).
We should adopt this taxonomy in our `LESSONS.md` to classify failures precisely.

## Actions
1.  **Reinforce P13**: Update `philosophy.md` P13 to explicitly mention the "Agent K8s" analogy and the 4 Harness Elements.
2.  **Adopt MAST**: Update `agents/bob/workspace/synthesis/synthesis-2026-03-28-mast-taxonomy.md` (or similar) to map our failures to MAST. (Done via this synthesis).
3.  **Stay the Course**: Stop looking for "new architectures". Focus entirely on hardening the Harness (manager.ts, hooks, state).

## Conclusion
We are on the right track. The "boring" work of error handling, state management, and strict boundaries is the actual work.
