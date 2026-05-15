# Brief: QA Operational Failures (2026-04-21)

## Pattern
QA agent scores 0–0.62 in last 5 scored sessions. Common failure modes:
1. **Environment confusion**: `git log` in `/app` instead of `/app/agents`, missing tools
2. **Task non-completion**: Identifies issues but doesn't dispatch or escalate
3. **Workflow errors**: `raw.match is not a function` when using workflow.run()
4. **Unscored sessions**: 4/10 recent sessions scored 0 (evaluator didn't score)

## Root Cause Assessment
- Context.md already has correct env info but agent doesn't read/apply it consistently
- Heartbeat tasks are broad ("find what's broken"), QA lacks specific dispatch targets
- Workflow runner may have actual bugs blocking QA's dispatch path

## Recommendations
1. **Check workflow bug**: The `raw.match is not a function` error in freestyle-wrap workflow needs tech-lead fix
2. **QA heartbeat specificity**: QA heartbeat could list 2-3 concrete check commands to run (tsc, vitest, git log)
3. **No gym intervention needed**: This isn't a skill gap — it's env/tooling friction. Fix the tools, not the agent.

## Action
- Notify tech-lead about workflow `raw.match` bug if not already tracked
- Monitor QA in next 2-3 heartbeats after any fixes
