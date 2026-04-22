# EXP-196: Verification Remasking — Reset Over Repair

**Date**: 2026-06-19
**Status**: DESIGNED
**Predecessors**: EXP-099 (FM-3.3 gravity well), DD#859 (error absorber theory)
**Hypothesis**: H-185 (Verification Remasking)
**Project**: prove-the-loop

## Research Question

Can a **verification remasking** SOUL instruction — telling agents to discard contaminated verification state and re-derive from clean context — reduce verification loop depth by ≥40% and improve task completion by ≥15pp on FM-3.3-dominant scenarios?

## Background

EXP-099 found FM-3.3 (verification failure/loops) is the single largest failure mode at 20.3% of all errors. DD#859 established that verification steps become "error absorbers" due to five structural mechanisms, with the key insight being **attribution collapse**: each re-verification pass inherits the same contaminated mental model, compounding rather than resolving errors.

H-185 proposes an analogy from masked diffusion LMs (DD#856): when context is contaminated, replacing errors from that context compounds them (79.9% last-mile corruption). The fix is to "remask" — discard contaminated state and re-derive from clean input. Applied to verification: discard prior verification notes and re-verify from only the original requirements + deliverable.

## Intervention: Verification Remasking SOUL Text

The treatment adds the following block to the SOUL's verification section:

```markdown
## Verification Remasking

When verifying your work, contaminated context is your enemy. Each re-verification pass
that builds on prior verification notes risks compounding errors rather than resolving them.

**Rule: If you have verified something twice and found different issues each time, STOP.**

1. Discard your verification notes entirely — do not re-read them
2. Re-read ONLY the original requirements/task description
3. Re-read ONLY your deliverable (the actual files you changed)
4. Verify fresh from these two inputs alone — as if seeing the work for the first time

**Why this works:** Verification loops happen when your mental model of "what's wrong" becomes
self-reinforcing. Each pass finds new issues because you're re-interpreting through a contaminated
frame. Resetting to clean inputs breaks the loop.

**When NOT to remask:** If both verification passes found the SAME issue, that's convergent
evidence — fix it normally. Remasking is for divergent verification: different issues each time,
growing uncertainty, or the feeling of "going in circles."
```

## Design

### Scenarios

Two verification-heavy scenarios where FM-3.3 is the dominant failure mode:

| Scenario | Why Selected | FM-3.3 Relevance |
|----------|-------------|-------------------|
| `compound-edit-verification` | 4-file dependency chain with hidden cross-file dependencies. Agents repeatedly re-verify individual files without catching integration-level issues. Tagged FM-3.3. | Verification loops across dependency chain — agents find different issues in different files each pass |
| `partial-verification-trap` | Partial verification passes create false confidence, leading to re-verification spirals when integration tests fail | Agents cycle between "looks fixed" and "still broken" |

### Arms

| Arm | N | Scenarios | Intervention |
|-----|---|-----------|-------------|
| Control | 5 per scenario (10 total) | compound-edit-verification, partial-verification-trap | Current SOUL (no changes) |
| Treatment | 5 per scenario (10 total) | compound-edit-verification, partial-verification-trap | Current SOUL + remasking block added to verification section |

**Total runs: 20** (10 control + 10 treatment)

### Execution Method

**Prompt-only, no gym infrastructure changes required.**

This experiment modifies only the SOUL text provided to the agent. Execution approach:

1. **Control arm**: Run scenarios normally via existing gym infrastructure (`compound-edit-verification` and `partial-verification-trap` with default SOUL)
2. **Treatment arm**: Create scenario variants (`compound-edit-verification-exp196` and `partial-verification-trap-exp196`) that are identical to originals except the task preamble includes the remasking SOUL block above
3. Both arms use the same `success_criteria.js` — no evaluation changes needed

**Scenario variant creation**: Copy each scenario directory, append `-exp196` suffix, and prepend the remasking block to `task.md`. No other changes.

### Metrics

| Metric | How Measured | Expected Effect |
|--------|-------------|-----------------|
| **Verification loop depth** (primary) | Count of re-verification attempts in session transcript. A "re-verification" = agent re-reads/re-checks a file it already verified. Count from transcript grep for read-after-edit patterns on same file. | Treatment ≥40% reduction (H-185 prediction) |
| **Task completion rate** (primary) | Binary pass/fail from `success_criteria.js` | Treatment ≥15pp improvement (H-185 prediction) |
| **Time to completion** (secondary) | Wall-clock session duration from gym run metadata | Treatment faster (fewer wasted verification cycles) |
| **Remasking trigger rate** (diagnostic) | Count of sessions where agent hits the 2-pass threshold and actually performs a remask | Expect ~50-70% of treatment sessions trigger remasking |

### Verification Loop Depth Measurement

Manual measurement from session transcripts. Operational definition:

A **verification pass** on artifact X is any sequence where the agent:
- Reads file X after having already edited it, AND
- Makes an evaluative statement about correctness ("looks good", "still broken", "this needs fixing", etc.)

**Loop depth** = total verification passes across all artifacts in the session. A session with 3 files each verified twice = depth 6.

### Success Criteria

- **Primary**: Treatment reduces mean verification loop depth by ≥40% vs control
- **Secondary**: Treatment improves pass rate by ≥15pp vs control
- **Reject if**: Treatment pass rate is ≥10pp *worse* than control (over-remasking causing under-verification)
- **Prove the loop**: If primary AND secondary met, H-185 is confirmed and remasking guidance should be integrated into production SOUL

### Statistical Note

N=5 per arm per scenario is small. Given H-185's ≥40% loop reduction prediction, even N=5 should show visible signal. If results are ambiguous (e.g., 10-30% reduction), follow up with N=15 per arm. The two-scenario design provides internal replication — if the effect appears in both scenarios, that's stronger evidence than a single scenario at higher N.

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Over-remasking: agent resets too eagerly, losing valid verification findings | 2-pass threshold in the SOUL text; "when NOT to remask" clause for convergent evidence |
| Under-verification: agent uses remasking as excuse to skip thorough checking | Success criteria includes pass rate — if remasking hurts completion, we detect it |
| Scenario selection bias: chosen scenarios don't actually trigger FM-3.3 loops | Both scenarios are tagged/designed for verification challenges; control arm confirms baseline loop behavior |

## Execution Checklist

- [ ] Create `compound-edit-verification-exp196` scenario variant (copy + add remasking block to task.md)
- [ ] Create `partial-verification-trap-exp196` scenario variant (copy + add remasking block to task.md)
- [ ] Run control arm: 5x `compound-edit-verification`, 5x `partial-verification-trap`
- [ ] Run treatment arm: 5x `compound-edit-verification-exp196`, 5x `partial-verification-trap-exp196`
- [ ] Extract session transcripts for all 20 runs
- [ ] Measure verification loop depth from transcripts (manual coding)
- [ ] Compile results into `results.md`
