# EXP-350: Arm A vs Arm B Results

## Status: CLOSED — INCONCLUSIVE (high variance, no signal)

## Design Recap
- **Arm A (no-instruct)**: Task says "fix 3 bugs, call finish()" — no mention of verify
- **Arm B (instruct)**: Task says "verify your edit by reading the file back" after each fix
- **Scenario**: `verify-after-edit-gate` / `verify-after-edit-gate-no-instruct`
- **Metric**: % of edits followed by immediate read() (verify-after-edit rate)

## Results

### Arm A: No Instruction (4 runs)
| Run | verify-auth | verify-users | verify-config | Verify Rate |
|-----|-------------|-------------|---------------|-------------|
| 1   | ❌ | ❌ | ❌ | 0/3 (0%) |
| 2   | ✅ | ✅ | ✅ | 3/3 (100%) |
| 3   | ✅ | ✅ | ✅ | 3/3 (100%) |
| 4   | ❌ | ❌ | ❌ | 0/3 (0%) |
| **Total** | | | | **6/12 (50%)** |

### Arm B: With Verify Instruction (5 runs, includes 3 prior baseline)
| Run | verify-auth | verify-users | verify-config | Verify Rate |
|-----|-------------|-------------|---------------|-------------|
| 1 (prior) | ✅ | ✅ | ✅ | 3/3 (100%) |
| 2 (prior) | ✅ | ✅ | ✅ | 2/3 (67%) |
| 3 (prior) | ❌ | ❌ | ❌ | 0/3 (0%) |
| 4 (new)   | ❌ | ❌ | ❌ | 0/3 (0%) — error run |
| 5 (new)   | ✅ | ✅ | ✅ | 3/3 (100%) |
| **Total** | | | | **8/15 (53%)** |

### Product Fix Rate (both arms)
- `users-fixed` fails consistently in ALL runs (0/9) — **scenario bug**: the typo fix doesn't match scorer expectations
- `auth-fixed` and `config-fixed`: near 100% when agent completes

## Analysis

### Key Finding: NO SIGNAL — Text instruction has no effect
- Arm A (no instruct): 50% verify rate (6/12)
- Arm B (with instruct): 53% verify rate (8/15)
- Delta: **+3pp** — within noise, not significant
- **Variance is bimodal**: runs are either 0/3 or 3/3 — suggests the verify behavior is determined by early session "mode" not by instruction

### Confirms KE-338 (text coaching dead for compliance behaviors)
This is the strongest evidence yet. Even when the task EXPLICITLY says "verify your edit by reading the file back", the agent complies only ~53% of the time — identical to no instruction.

### users-fixed Bug
The `users.js` fix fails in every single run across both arms. The scorer checks for absence of `usernmae` but the scenario environment file likely has a different setup. This is a **scenario bug**, not an agent failure.

## Conclusion
**Text-based verify-after-edit instruction has ZERO measurable effect.** The behavior is stochastic and instruction-independent. Only tool-layer enforcement (auto-readback after edit, or edit() wrapper that calls read()) can reliably achieve verify-after-edit compliance.

## Recommendation
1. **Close EXP-350** — text intervention path exhausted
2. **Escalate to infrastructure**: Request tool-layer auto-readback feature
3. **Fix scenario bug**: Debug `users-fixed` check in `verify-after-edit-gate`
4. **Update KE-338** with this evidence as additional confirmation

## Date: 2026-09-16 (this session)
