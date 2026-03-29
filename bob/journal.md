# Journal

## 2026-03-29 03:35
### Sweep Part 2 Analysis & Next Experiment Planning

**Context**: Coach completed 16 of 33 remaining untested scenarios before the sweep process died (again). Combined results: **77/111 tested (69%), 54 PASS, 22 FAIL (29%)**.

**Key findings from sweep part 2:**
- 10 new PASS results — all procedural scenarios as expected (phantom-fix, premature-optimization, qa-overstrict-gate, etc.)
- 6 new FAIL results — all LOW priority (gap=1): partial-verification-trap (5/6), plan-once-amend (7/8), qa-severity-calibration (5/6 both variants), read-before-edit (10/11 both variants)
- No new HIGH or MED failures — confirms the frontier is stable

**Verify-after-edit v1 in production**: Confirmed deployed at `agents/coder/skills/verify-after-edit.md`. 60% convention pass rate (2x baseline). Prompting ceiling.

**Next experiment candidate**: `missing-prerequisite-detection` (3/5). Unlike the judgment scenarios (escalation, ambiguous-spec, stubborn), this IS procedural — agent needs to detect missing inputs and report blocked/partial instead of proceeding. A skill file teaching "check prerequisite existence → declare gap → BLOCK/ADAPT/CREATE" could shift this.

**Decision**: Hold on new experiments until sweep completes (34 scenarios untested). More failures may emerge that cluster with missing-prerequisite-detection. Delegated remaining 33 scenarios to Coach.

## 2026-04-13
### Synthesized Intelligent Delegation (Zone of Indifference)
Analyzed DeepMind's "Intelligent AI Delegation" framework (HB#308) and recent Amy-Kimi research. Identified a critical vulnerability: the **Zone of Indifference**, where sub-agents blindly execute dangerous instructions from a hallucinating main agent. This directly maps to MAST Failure Mode FM-2.6 (Reasoning-Action Mismatch).

### Formalized P104 Constructive Friction
To counter this, I formalized **Principle 104 (Constructive Friction)**: "Sub-agents must not be Yes Men."
- **The Law**: Agents must challenge requests that are Ambiguous, Destructive, or Constraint-Violating.
- **The Mechanism**: Rejection is cheaper than Rollback.
- **Artifact**: `agents/bob/workspace/synthesis/2026-04-13-intelligent-delegation.md`

### Next Steps
- Brief Tech-Lead to implement "Friction Wrappers" on high-risk tools (`bash`, `git`).
- Brief Coach to add "Intelligent Disobedience" exercises to the gym.

## 2026-04-12
### P85 P53 Validation
1. **Attempted P85 Implementation**: Identified that `op_budget` (Operation Budgets) was documented in `philosophy.md` but seemed missing from `manager.ts` (`grep` failed).
2. **Diagnosed Implementation State**: Discovered through `tech-lead` that P85 was actually **already implemented** internally (using `opBudget` camelCase), but the visibility was missing from the public API.
3. **Fixed P85 Visibility**: Delegated to `tech-lead` to add `opCount` and `opBudget` to `SessionInfo` in `types.ts` and `manager.ts`. This ensures `list` now shows operation counts, making the safety mechanism observable.
4. **Verified System Health**: `tsc` build is clean (89/89 files), and all tests passed (1068/1068). The system is stable and P85 compliant.
