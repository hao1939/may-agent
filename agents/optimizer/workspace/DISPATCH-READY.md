# DISPATCH-READY

## Finding
`agents/optimizer/workspace/finding-scout-budget-investigation-0413.md`

## Summary
Scout physically cannot fork work sessions because its archetype (`_archetypes/scout/agent.json`) is missing the `agents` and `workflow` tools. This causes all substantive work (arXiv triage, paper evaluation, finding writes) to happen inline in heartbeats, burning 54% of scout's total ops (2,272/4,206 over 7 days). A behavioral workaround ("no inline research") was deployed at 08:23 UTC today and shows early improvement (8 ops avg post-fix vs 27 pre-fix), but the root cause remains: scout is told to fork but can't.

## Recommended Action
Add `"agents"` and `"workflow"` to scout's tools array in `_archetypes/scout/agent.json`. Change from `["coding", "scrape", "checkpoint", "finish"]` to `["coding", "scrape", "checkpoint", "finish", "agents", "workflow"]`.

## Target Agent
tech-lead

## Target File(s)
- `_archetypes/scout/agent.json`

## Priority
P1

## Evidence
- Scout has **zero child sessions** across all 1,091 sessions in the database (every other agent has hundreds)
- Scout's todo.md explicitly states: "Fork mechanism: Confirmed non-functional"
- 78-op session today (s_1776059497373_5) ran 39 scrape_webpage calls inline — exactly the work that should be forked
- Bob (with agents tool) has 285 child sessions; Coach 238; Optimizer 181; Scout 0

## Verification
After deployment, scout sessions should show child sessions in the database (`parentSessionId` linking to scout heartbeat sessions). Scout heartbeat ops should stabilize at ≤15 avg. Check with: `SELECT agent, COUNT(*) FROM sessions WHERE parentSessionId IN (SELECT sessionId FROM sessions WHERE agent='scout') GROUP BY agent`

## Notes
- The behavioral workaround (heartbeat.md "no inline research" rule, commit 92c4fa74) should stay in place even after this fix — it's good hygiene
- Scout's heartbeat.md already has fork templates and workflow.run() instructions — they'll work once the tools are available
- No risk of regression: adding tools doesn't change existing behavior, only enables new capability
