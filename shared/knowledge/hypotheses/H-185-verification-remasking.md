# H-185: Verification Remasking — Reset Over Repair

**Status:** PROPOSED
**Created:** 2026-04-23
**Source:** DD#856 (T2M paper), EXP-099 (verification gravity well)
**Related:** H-177 (BI predictability), FM-3.3

## Claim

When agents detect a verification loop (re-checking the same work with the same assumptions), resetting the verification context entirely — discarding prior verification state and re-deriving from the original task + artifacts only — will break the gravity well pattern more effectively than iterative re-verification.

## Mechanism

DD#856 shows that in masked diffusion LMs, replacing errors from contaminated context compounds errors (79.9% "last-mile corruption"). The fix: reset to mask token and re-derive from clean context. 

Our analog: verification loops fail because each iteration re-checks from the same contaminated frame (same assumptions, same mental model). A "remask" intervention would:
1. Detect loop entry (e.g., 2+ verification passes on same artifact)
2. Discard all prior verification reasoning
3. Re-verify from scratch: only the original task spec + the artifact, no prior verification notes

## Testable Prediction

On scenarios where FM-3.3 (verification gravity well) is the dominant failure mode, a "remask" SOUL instruction will reduce verification loop depth by ≥40% and improve task completion by ≥15pp.

## Experiment Design

**Prompt-only test (no gym needed):**
- Treatment: Add SOUL guidance — "If you've verified something twice and found different issues each time, STOP. Discard your verification notes. Re-read only the original requirements and your deliverable. Verify fresh."
- Control: Current SOUL
- Measure: Verification loop depth, task success on verification-heavy scenarios

## Risk

Low — prompt-only change. Risk of under-verification if agents reset too eagerly. Mitigate with "2+ passes" threshold.
