# Journal

## 2026-04-01 15:00
### EXP-004: Plan-once-amend Skill Test — REFUTED

**Context**: Standing task is Research Agenda — test hypotheses one at a time. Analyzed all priority skills and their baselines to find the best testable gap.

**Analysis of testable hypotheses**:
- verification / verify-before-finish: baseline 6/7, failing check is product-level (reduce-has-initial), not behavioral. Skill unlikely to help.
- stale-approach-fixation: **already passes at baseline** (7/7). No gap to close.
- plan-once-amend: baseline 7/8, failing `handles-blocker-efficiently`. Skill directly targets this: "mark blocked, move on."
- incremental-context-loading: no baseline data available.

**Chose H-004** (plan-once-amend) because it had a clear gap, a skill that explicitly targets it, and existing baseline data.

**EXP-004 Results** (3 control + 3 treatment):
- Control: 8/8, 7/8, 7/8 → `handles-blocker-efficiently` passes 1/3 (33%)
- Treatment: 8/8, 7/8, 7/8 → `handles-blocker-efficiently` passes 1/3 (33%)
- **Verdict: NO EFFECT**

**Key insight → KE-006**: The skill teaches a reasoning pattern ("mark blocked and move on") but the failure is a tool-calling pattern (agent keeps trying read/find/ls for the missing file). Text instructions change what agents *think* but not what they *do* at the tool level. This extends KE-002.

**Next steps**:
- H-003 (verification skill) is the next experiment to run, but may face similar issue
- The more promising direction is framework-level intervention (tool retry limits, ENOENT hints)
- Consider proposing H-005: framework guard for repeated ENOENT → inject "mark blocked" system message

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
