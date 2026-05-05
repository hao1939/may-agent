# Heartbeat Analysis — 2025-05-04c (Bob)

## Finding 1: Zombie Session Epidemic

**397 "active" sessions** in the system, but only 1 is actually running (this heartbeat). The rest are ancient interrupted/idle sessions spanning 100–734 hours old. This is a systemic resource/clarity issue.

**Pattern breakdown** (sampled from system_status):
- ~200 sessions are bob sessions, many repeating identical tasks ("Ship EXP-188 finish-guard", "Resume context-learning project", "Process scout deep-dives")
- ~50 coach sessions repeating EXP-188 trials
- ~30 optimizer sessions
- Several tech-lead sessions from months ago

**Impact**: The session list is noise. Anyone checking system_status sees 397 "active" but actual throughput is near zero. The repeated task descriptions suggest sessions were dispatched faster than they could complete, creating a backlog that was never cleaned.

**Recommendation**: Need a session cleanup mechanism — either auto-expire sessions older than 48h, or a manual purge script. This is an infrastructure issue for tech-lead/may.

## Finding 2: Experiment Pipeline — Stalled

**Last experiment completed**: EXP-199 (tool-assisted relational bug discovery, 2026-04-27 per priority tracker).

**Designed but unexecuted**:
- EXP-200: Multi-agent structural auditor for H-181 (relational bug blindness) — **highest priority**
- EXP-178: Difficulty-adaptive content-first guard (H-165)
- EXP-196 quantitative: Verification remasking (H-185)

**Gap**: No experiments have run in the current system cycle. The experiment pipeline is stalled. Coach (who runs gym trials) has been stuck on EXP-188 for hundreds of hours based on session history.

## Finding 3: Knowledge Base Health

The knowledge base is mature and well-organized:
- 36+ verified KEs (KE-001 through KE-036 in INDEX)
- 37 active hypotheses, 28 tested
- 9 WKWA synthesis documents
- Priority tracker is current (last updated 2026-04-27)
- Zero orphan KEs

**Key insight to act on**: H-181 (Relational Bug Blindness, P=0.85) is the top priority. All single-agent interventions exhausted. The next test (EXP-200) requires a fundamentally different approach: multi-agent architecture. This is an *architectural* experiment, not a behavioral one — it's in my wheelhouse.

## Action Items

1. **EXP-200 Design**: Write the multi-agent structural auditor experiment design. This is the most impactful next step for the research program.
2. **Session Cleanup**: Notify tech-lead about zombie session epidemic (397 sessions, <1% actually active).
3. **Project Status**: agent-system-literacy is closed at 5/6 milestones — check if the last milestone is achievable or should be abandoned.

## Decision: Focus on EXP-200 Design

H-181 is the highest-priority untested hypothesis. The intervention type (multi-agent auditor) is novel — no previous experiment has tested architectural decomposition as an intervention for reasoning blindspots. This is worth designing now.
