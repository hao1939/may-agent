# Journal

## 2026-06-29: M1 Diagnosis Complete

### Top 3 Failure Patterns

1. **shallow_session (49% of all evaluations, 235/480)**: Sessions with only 2 messages — no meaningful work performed. These are dispatch/infrastructure failures (sessions that crash on startup, receive empty tasks, or error out immediately). This is NOT a behavioral issue coach can fix — it's systemic. Bob has the same pattern (76% shallow). This single pattern drives the score from 0.486 → 0.346.

2. **FM-3.3 Verification Failure (8 occurrences)**: Claiming success without verification evidence. The work-session-scaffold and verify-before-finish skill already address this. Context.md has the rules embedded. Recent sessions show improvement.

3. **Orchestrator role failures (3-4 occurrences)**: When coach is dispatched as project orchestrator, it sometimes loops without pushing forward. Related to unfamiliar dispatch patterns.

### Key Finding

**Excluding shallow sessions, coach averages 0.486 quality** — already near the 0.50 target. The 0.24 reported score is dragged down by infrastructure failures, not behavioral issues.

### Recommendation

- M2/M3 should focus on: (a) preventing shallow sessions (infra fix — escalate to optimizer), (b) further reducing FM-3.3 in real sessions
- The work-session-scaffold already addresses behavioral issues
- The biggest ROI is fixing the shallow_session problem at the dispatch/infrastructure level
