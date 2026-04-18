# Design Review: Convention Loop
### Verdict: Aligned ✅

The proposal to merge `best-practices.md`, `common-sense.md`, and `CONVENTIONS.md` into a unified system with a mechanical feedback loop is **strongly aligned** with our design philosophy.

### Alignment Check
- **P1 Simplest Thing That Works:** Consolidating 4 overlapping docs into 1 registry + 1 injection reduces cognitive load and maintenance overhead.
- **P42 Minimalism:** Reducing the system prompt injection from ~12.5KB to ~4KB (~66% reduction) significantly improves signal-to-noise ratio and reduces cost.
- **P26 Evolution over State:** Introducing the `convention-check` handler creates a mechanism for improvement (feedback loop) rather than just stating rules (static state).
- **P131 Code is Law:** Moving from text-based "best practices" to mechanically enforced checks shifts the burden from agent memory to system infrastructure.

### Risk Analysis
- **Transition Friction:** Agents trained on the old `common-sense.md` structure might briefly hallucinate missing sections (ownership, status). *Mitigation: The new lean file retains the core rules, just removes metadata.*
- **Registry Desync:** If `common-sense.md` is manually edited without updating `CONVENTIONS.md` registry. *Mitigation: The design clearly defines CONVENTIONS.md as the canonical source.*

### Recommendations
- **Execute Immediately:** This is a high-leverage cleanup.
- **Phased Rollout:**
    1. **Content Merge (This Session):** Update the files first.
    2. **Infra Build (Next Session):** Build the handler and DB schema.
    3. **Cleanup:** Remove `best-practices.md` only after handler is active.
