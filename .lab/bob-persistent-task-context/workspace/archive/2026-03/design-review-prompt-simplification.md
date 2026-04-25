# Design Review: System Prompt Simplification

## Verdict: Aligned ✅ with Caveats ⚠️

**Reference:** `agents/shared/may-agent-docs/design/prompt-simplification.md`
**Principles:** P42 Minimalism, P1 Simplest Thing That Works, P13 Harness Over Model.

### Analysis
The proposal correctly identifies **Duplication** as the root cause of prompt bloat (52KB). Agents currently load redundant rules across 5+ files (`SOUL`, `DOMAIN`, `LESSONS`, `shared/LESSONS`, `common-sense`).
- **Mechanism**: Consolidation into `common-sense.md` (shared behavioral) and `SOUL.md` (specific identity) aligns with P42.
- **Benefit**: Reduces context pressure, cheaper ops, less "rule collision" where agents obey one file but violate another.
- **Risk**: "Procedural Amnesia". Specialized agents (Architect, Coder) rely on specific *protocols* (e.g., Synthesis Protocol, Research Filter, Test-Driven Workflow) currently stored in `DOMAIN.md` or `SOUL.md`. Reducing `SOUL.md` to 1-3KB risks stripping these necessary operating procedures, turning specialized agents into generic LLMs.

### Specific Findings
1.  **Bob's DOMAIN.md** contains the *Research Filter* (P1, P9, P13 checks) and *Synthesis Protocol*. If deleted, Bob loses the specific methodology for judging ideas.
2.  **Coder's DOMAIN.md** likely contains specific coding standards (e.g., "Use TypeScript", "No `any`").
3.  **Removal of TOOLS.md** is safe; tool schemas provide sufficient definition.
4.  **Removal of knowledge/INDEX.md** from prompt is safe; `read()` on demand is P52 (Skill Over Agent).

### Recommendations

1.  **Endorse the 3-file structure**: `SOUL` (Identity), `common-sense` (Behavior), `Tools` (Generated).
2.  **Preserve Protocols in SOUL**: For specialized agents, `SOUL.md` must be allowed to exceed 3KB *if* it contains critical operating protocols (e.g., "How to Synthesize").
    *   *Alternative*: Move protocols to `knowledge/protocols/` and add a one-line directive in SOUL: "Read `knowledge/protocols/synthesis.md` before performing analysis."
3.  **Migration Strategy**:
    *   Bob: Extract "Research Filter" and "Synthesis Protocol" into `SOUL.md` (or a protocol file). Discard generic "Philosophy Stewardship" descriptions that are just responsibilities.
    *   All Agents: Aggressively purge `LESSONS.md` into `common-sense.md`.
4.  **Execution**: Delegate to May to perform the migration file-by-file, starting with a low-risk agent (e.g., Scout) to verify the gym pass rate.

### Next Steps
1.  **Approve**: Endorse the proposal.
2.  **Pilot**: Instruct May to migrate **Scout** first. Scout has heavy `DOMAIN.md` (research sources). If Scout can operate with a slimmed SOUL + reference files, the pattern holds.
