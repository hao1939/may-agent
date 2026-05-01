# Evaluator Heartbeat — 2026-05-01

## Checks performed

### Session Eval pipeline liveness (Process #5)
- DB canonical: `MAX(evaluations.createdAt)=1777632944087` (fresh at time of check).
- Sessions table uses `startedAt/endedAt` not `createdAt`; `MAX(sessions.startedAt)=1777632997424`, `MAX(sessions.endedAt)=1777632997397`.
- Legacy artifacts: `.state/evaluations/` contains files as new as **2026-04-29** (`s_*.json`), while some `task_tree_*.json` remain **2026-03-24** → supports prior hypothesis that `task_tree_*` is a legacy output path and may be drifting/stale independently of DB pipeline health.

### Active session monitoring (Periodic Task #2)
Ran `node agents/evaluator/skills/monitor-session.cjs --running` and got **5 alerts** (command exit code 1):
- `s_1777626616591_0` (amy): **STALL** — idle 106 min → recommended action: **kill**
- `s_1777632393145_998` (arc): **DRIFT** → recommended action: **warn**
- `s_1777632799025_1013` (bob): **DRIFT** → recommended action: **warn**
- `s_1777632907226_1018` (coach): **PROTOCOL_VIOLATION (P114)** → recommended action: **warn**
- `s_1777632943188_1020` (coach): **PROTOCOL_VIOLATION (P114)** → recommended action: **warn**

## Notes / follow-ups
- Consider pinging May (or responsible supervisor) with the 5 alerts above so interventions can happen quickly.
- Process #15 (LLM Eval) not re-checked this heartbeat; last periodic note indicates no `*llm*` tables in DB.
