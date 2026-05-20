# Signal Heuristics v1

Automated quality signals extracted from session transcripts without human labels.

## Self-Signals (per session)

### S1: Goal Completion
- **Measure**: Did the session call `finish(success)` AND have at least one write/edit/bash that changed state?
- **Score**: 1 (yes with evidence) / 0.5 (finish success but no observable output) / 0 (no finish or finish failure)
- **Weight**: 0.30

### S2: Loop Detection
- **Measure**: Count sequences where the same bash command (or near-duplicate) appears 3+ times with similar error output.
- **Score**: 1 (no loops) / 0.5 (1 loop, recovered) / 0 (2+ loops or never recovered)
- **Weight**: 0.20

### S3: Error Recovery
- **Measure**: When an error occurs, does the next action change approach or repeat?
- **Score**: 1 (always changes approach) / 0.5 (sometimes) / 0 (always retries same thing)
- **Weight**: 0.15

### S4: Tool Efficiency
- **Measure**: Ratio of "useful" tool calls (read files that get edited, bash that succeeds) to total tool calls.
- **Score**: Continuous 0-1. >0.7 is good, <0.3 is wasteful.
- **Weight**: 0.15

### S5: Clean Finish
- **Measure**: Does verification_evidence cite specific tool outputs with line numbers/exit codes?
- **Score**: 1 (specific evidence) / 0.5 (vague evidence) / 0 (no evidence or self-validation)
- **Weight**: 0.10

### S6: Scope Discipline
- **Measure**: Did the session stay focused on one task or drift across multiple unrelated concerns?
- **Score**: 1 (focused) / 0.5 (minor drift) / 0 (major drift or abandoned original task)
- **Weight**: 0.10

## Cross-Session Signals

### X1: Work Undone
- **Measure**: Did a session within 24h revert/overwrite files this session wrote?
- **Score**: 0 (undone) / 1 (persisted)
- **Impact**: Multiplier — if undone, halve the session score.

### X2: Output Referenced
- **Measure**: Did any later session read files this session created/modified?
- **Score**: 0 (never referenced) / 1 (referenced)
- **Impact**: Bonus +10% if referenced within 48h.

### X3: Project Progress
- **Measure**: Did the project's iteration counter advance after this session?
- **Score**: 0 (no) / 1 (yes)
- **Impact**: Bonus +10% if project advanced.

## Composite Score

```
raw = S1*0.30 + S2*0.20 + S3*0.15 + S4*0.15 + S5*0.10 + S6*0.10
multiplier = X1 (0.5 if undone, 1.0 otherwise)
bonus = (X2 * 0.10) + (X3 * 0.10)
final = clamp(raw * multiplier + bonus, 0, 1)
```

Map to 1-5: `score = round(final * 4) + 1`

## Calibration Notes
- v1: initial heuristics, weights are guesses. Will adjust after first batch.
- Expect S1 (goal completion) to dominate. May need to reduce weight if it drowns other signals.
- Cross-session signals require access to session index — may not be available for all sessions initially.
