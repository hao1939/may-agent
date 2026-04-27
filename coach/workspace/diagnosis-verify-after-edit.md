# Diagnosis: verify-after-edit Behavioral Pattern

## Error Pattern
**FM-3.3 VERIFICATION_FAILURE** — Agent edits files but does not verify the edit took effect correctly. Manifests as:
- Editing a file then calling finish() without re-reading to confirm
- Claiming "edit applied" based on edit tool return, not independent verification
- Missing silent edit failures (wrong oldText, partial match, etc.)

## Target Agent
**coder** — primary agent that performs file edits in production

## Selected Scenarios (3)
1. **approach-validation-trap** — Tests whether agent traces evidence before concluding (coach agent_type, but tests verification discipline)
2. **assertion-without-evidence** — Agent must find and run correct integration test, not just claim verification (FM-3.3, coder)
3. **ambiguous-context-drift** — Agent must verify actual file state before proceeding based on injected context (FM-2.6/verification, coder)

*Also relevant*: **convention-verify-edit** — directly tests verify-after-edit convention compliance (already tested in EXP-213/214)

## Selected Method
**Method #17: Verification Gates** — forced readback gate after edits

## Why This Method

### Evidence from catalog:
- **EXP-055 (Method #17)**: On read-before-edit scenario, forced readback gate achieved **100% C2.3 pass** (up from 0% baseline). This is the ONLY approach that consistently fixes C2.3 verify-after-edit behavior.
- **EXP-213 (skill injection)**: verify-after-edit skill on convention-verify-edit achieved 60% convention pass (up from 30%). Positive but insufficient.
- **EXP-214 (skill v2)**: Strengthened skill REGRESSED to 10%. Text refinement backfired.
- **EXP-055b**: Verified the gate mechanism works but has budget tradeoff (extra tool calls consume time).

### Reasoning:
1. Text-based skills show inconsistent results for this pattern (30-60% at best, regression risk)
2. Method #15 (workflow enforcement) is overkill — this is an intra-phase cadence issue, not a phase-skipping issue
3. Method #17 mechanically forces the verification behavior via a gate between edit and finish
4. The catalog notes: "Verification gates work but need budget-awareness" — the mechanism is confirmed, deployment needs tuning

### What specifically to change:
- Create lab fork of coder with verify-after-edit skill that mandates `read()` after every `edit()` call
- Test on the 3 scenarios above as baseline (no skill) vs treatment (with skill)
- Measure: (a) does verification behavior appear, (b) any product regression from extra tool calls
- If skill insufficient, escalate to Method #17 hard gate (programmatic enforcement)

## Prior Experiments on This Pattern
| Exp | Method | Scenario | Result |
|-----|--------|----------|--------|
| EXP-055 | #17 Verification Gate | read-before-edit | 100% C2.3 ✅ but product regression |
| EXP-055b | #17 + longer timeout | read-before-edit-7min | REJECTED — regression is gate-driven |
| EXP-213 | skill injection v1 | convention-verify-edit | 60% convention (up from 30%) |
| EXP-214 | skill injection v2 | convention-verify-edit | 10% — REGRESSED |

## Gym Run Plan
```
# Baseline runs (no skill)
gym run coder approach-validation-trap    x3
gym run coder assertion-without-evidence  x3  
gym run coder ambiguous-context-drift     x3

# Treatment runs (with verify-after-edit skill)
gym run coder-verify-edit approach-validation-trap    x3
gym run coder-verify-edit assertion-without-evidence  x3
gym run coder-verify-edit ambiguous-context-drift     x3
```
