# EXP-210: Schema-Organized Context vs. Flat List Context

**Date**: 2026-06-28 | **Updated**: 2026-07-28
**Status**: BLOCKED — gym in stub mode (no GYM_AGENT_BIN). Lab fork ready at agents/.lab/coder-schema-context/. Needs real agent binary to execute.
**Hypothesis**: H-077 (Schema-Organized Context Activates Knowledge Better Than Flat Lists)
**Predecessor**: H-EXP-012 (75% known-but-violated rate), EXP-164 (information provision works)

## Research Question

Does restructuring an agent's context.md from a flat list of facts into trigger-based sections reduce knowledge-activation failures?

## Design

### Arms

**Arm A (Control)**: Current coder context.md — mixed format with categories like "Mandatory Procedures", "Convention Compliance", "Quality Improvement Rules" (139 lines).

**Arm B (Treatment)**: Schema-organized context.md at `agents/.lab/coder-schema-context/context.md` — same rules reorganized by **trigger moment** (73 lines):
- `[BEFORE EDITING ANY FILE]` — C1.1 read-before-edit
- `[AFTER EVERY write() CALL]` — C1.3 verify
- `[SESSION START]` — C12.1 orientation
- `[BEFORE CALLING finish()]` — FM-3.3 verification
- `[AFTER FIXING A BUG]` — cascading/pipeline trace
- etc.

Key differences:
1. **Trigger-based headers** instead of category-based (e.g., "Convention Compliance")
2. **Shorter** (73 vs 139 lines) — removed redundant restatements
3. **Situational cross-refs** removed; each section is self-contained for its trigger moment

### Test Scenarios

Primary: `read-before-edit` — coder baseline is 54.8% (N=31). Directly tests C1.1 activation.

Secondary: `efficient-file-reading` (25%, N=12), `coder-post-write-verify` (73.3%, N=45) — test C1.3 and related discipline.

### Protocol

1. Run 10 trials of `read-before-edit` with `--agent .lab/coder-schema-context`
2. Compare to existing baseline (54.8%, N=31)
3. If treatment >= 70% (p < 0.05 via Fisher's exact), proceed to secondary scenarios
4. If treatment >= 70% on 2+ scenarios, promote schema format to coder context.md

### Rejection Criteria
- Treatment < 60% on primary scenario → REJECT (no meaningful improvement)
- Treatment < baseline → REJECT immediately

### Pre-registration
- Primary metric: pass rate on read-before-edit
- Minimum sample: N=10 per arm
- Decision threshold: ≥70% treatment pass rate on primary
