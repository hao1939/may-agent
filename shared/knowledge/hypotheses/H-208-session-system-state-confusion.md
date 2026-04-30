# H-208: Session-System State Confusion Causes Ghost Completions

**Created**: 2027-09-01 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong observational evidence)
**Source**: EXP-296 audit, evaluator flagged sessions
**Connects**: EXP-296, EXP-290, EXP-295, KE-338

---

## Claim

Agents confuse system-level completeness (project.md says "done") with session-level work (I haven't done anything yet this session), causing ghost completions. A session preamble that dynamically states "your session output so far: 0 files, 0 edits" would reduce false completion claims by >50%.

## Mechanism

When an agent loads context including a project.md that shows prior milestones completed, the agent pattern-matches "this is done" and calls finish(success) without producing any work. The agent lacks a salient signal distinguishing "the system says this is done" from "I personally have not verified or produced anything this session." This is analogous to the "false memory" problem in LLMs — the model treats read context as experienced action.

## Evidence

### Supporting
- EXP-296: 4+ sessions/week with ghost completions (agent claims done, 0 files produced)
- s_1777483248275_448: coach looped 28 iterations claiming "project complete" with zero tool calls
- Anti-shallow rule (EXP-290) partially mitigates by forcing ≥5 tool calls, but doesn't address the root confusion
- Circuit breaker (master-worker.ts MAX_ZERO_OUTPUT=3) catches it after 3-6 iterations, not before

### Against / missing
- Could be a simpler laziness pattern (agent minimizes work) rather than genuine confusion
- No controlled experiment yet comparing sessions with/without dynamic session-state preamble
- Anti-shallow + circuit breaker may have already reduced the problem enough that this isn't worth pursuing

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Add dynamic "session output: 0 files" counter to prompts | Ghost completion rate drops >50% |
| Remove anti-shallow rule but keep session counter | Some ghost completions return but fewer than without both |
| Agents given explicit "you are in iteration 1 of a fresh session" | First-iteration false claims drop significantly |

## Test Plan

- **Design**: A/B in gym. Arm A: baseline worker prompt. Arm B: worker prompt + dynamic session output counter ("You have produced 0 files and made 0 edits so far this session").
- **Scenario**: Gym scenario where project.md shows prior work complete but current task requires new output. Measure whether agent produces files or claims completion.
- **Decision rule**: confirmed if Arm B ghost completion rate <25% of Arm A; falsified if no difference.

## Implications if true

- Add dynamic session-state injection to master-worker.ts (low-cost infrastructure change)
- Could generalize: every agent session should start with "Session state: 0 files written, 0 edits, 0 tool calls" as a grounding mechanism
- Reduces reliance on anti-shallow rule (treats root cause, not symptom)

## Links

- Parent: EXP-296 (ghost completion detection)
- Related: EXP-290 (anti-shallow), EXP-295 (anti-shallow replication)
- Tracked in: agents/bob/workspace/hypotheses/
