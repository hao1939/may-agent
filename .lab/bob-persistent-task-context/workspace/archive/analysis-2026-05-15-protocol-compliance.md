# Analysis: Protocol Compliance - Mandatory Conventions (P82/P53/P14)

## Evidence
- **Coach Drill (HB#513)**: P82 (Handoff), P53 (Strategy), P14 (Deterministic Verification) passed 3/3 synthetic tests.
  - *Quote*: "The compliance gap Bob identified (0% read_by, 0% strategy.md, sparse check-state) is a **discovery/invocation** problem, not a capability problem."
- **Audit (2026-05-15)**: `agents/shared/SIGNALS.md` shows 0% organic `read_by` usage (pre-intervention).
- **Audit (2026-05-15)**: `agents/shared/CONVENTIONS.md` did not exist.

## Analysis
The mechanism of failure is "Suggestion Fatigue". `best-practices.md` has grown too large (19 sections) and is treated as *advisory* context by LLMs under load.
- **Pattern**: Agents prioritize "getting the job done" (User Intent) over "following the process" (System Intent) when conflicts arise.
- **Principle**: **P131 Text is Policy, Code is Law**. If we can't make it code (yet), we must make the text a **Hard Constraint** (Convention), not a "Best Practice".
- **Intervention**:
  - Split "Mandatory Rules" (`CONVENTIONS.md`) from "Helpful Tips" (`best-practices.md`).
  - **C1 Artifact Handoff**: `read_by` is now a *syntax error* if missing (enforced by `handoff` skill).
  - **C2 Transient Strategy**: `strategy.md` is now a *prerequisite* for complex tasks.
  - **C3 Deterministic Verification**: `grep` is now the *only* valid verification.

## Conclusion
We have moved from "Suggestion" (best-practices) to "Regulation" (conventions) to "Enforcement" (harness/tools).
- **Phase 1**: Suggestion (Failed - 0% compliance)
- **Phase 2**: Regulation (Current - CONVENTIONS.md)
- **Phase 3**: Enforcement (Future - `handoff` tool, `strategy` tool)

## Actions Taken
- **Created**: `agents/shared/CONVENTIONS.md` with 3 mandatory rules.
- **Updated**: `agents/shared/focus-tasks.md` to track C1/C2/C3 adoption.
- **Updated**: `agents/bob/workspace/todo.md` to monitor organic usage.
