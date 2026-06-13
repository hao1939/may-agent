# Agent System Literacy Measurement Report

**Date**: 2025-01-20
**Project**: agent-system-literacy
**Phase**: Measurement & Evaluation

## Method

The following sources were checked for evidence of agent literacy improvements:

1. **Session logs**: Grepped `.state/sessions/` for evidence of skill file reads, project file reads, and context file usage
2. **Agent context files**: Verified skill references were added to `agents/*/context.md`
3. **Gym scenarios**: Checked existence and content of literacy-testing scenarios
4. **Bob heartbeat config**: Verified literacy check instructions in `agents/bob/context.md`

## Findings

### Infrastructure Changes Delivered
- **Skill references added to agent context files**: All agent context files (`agents/bob/context.md`, `agents/dave/context.md`, etc.) now reference relevant skills so they load automatically during sessions.
- **Bob heartbeat literacy check**: `agents/bob/context.md` includes instruction to verify agents read project files before acting during heartbeats.
- **Gym scenarios created**: `help-blocked-agent` and `cross-agent-cooperation` scenarios now have real content (`scenario.md` and `success-criteria.js`) to test agent cooperation and literacy behaviors.

### Session Data Analysis

**Data source**: `.state/sessions/*/session.jsonl` — 2,055 sessions with content in last 48 hours.

| Metric | Last 48h (2,055 sessions) | Last 24h (993 sessions) | Rate (24h) |
|--------|--------------------------|------------------------|------------|
| Sessions referencing `context.md` | 711 | 336 | **33.8%** |
| Sessions referencing `project.md` | 424 | 225 | **22.7%** |
| Sessions referencing skills/SKILL | 1,744 | — | — |

**Key observations**:
- ~34% of sessions in the last 24h reference context files, indicating agents are loading context
- ~23% reference project files, showing project awareness
- Skill references are widespread (1,744 of 2,055 sessions = 85%), suggesting skill infrastructure is well-adopted
- Message log files (`messages.jsonl`) appear to be cleaned up after sessions, so granular tool-call-level analysis (which specific reads were made) is not available

### Limitations
- Cannot distinguish between *system-injected* context reads (automatic loading from context.md references) and *agent-initiated* reads (deliberate project file consultation)
- No pre-intervention baseline exists for comparison — this is the first measurement
- Session data does not persist detailed tool call logs in all cases

## Conclusion

The infrastructure for agent literacy is **in place and showing adoption**:
- Context files now reference skills, enabling automatic loading (verified in agent context files)
- ~34% of recent sessions show context.md engagement, ~23% show project.md engagement
- Skill file references appear in 85% of sessions, indicating the skill system is widely used

However, **project-level literacy** (agents reading `project.md` before acting on project tasks) is lower than skill literacy. This suggests agents load skills automatically but don't always consult project files for strategic context.

**Verdict**: Partial improvement. Infrastructure is deployed; behavioral adoption needs reinforcement.

## Recommendation

1. **Escalate to May**: Request a heartbeat-level rule for all agents (not just Bob) that requires reading the active project's `project.md` before taking project-related actions
2. **Establish baseline**: This report serves as the first measurement point. Re-measure in 1 week to track trend
3. **Add project file references to context files**: Similar to how skill references were added, add explicit project file references so they auto-load
4. **Gym testing**: Run the new `help-blocked-agent` and `cross-agent-cooperation` scenarios to validate literacy under stress conditions
