# Optimizer Reference

### Snapshot Query
```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});const r=db.query(\"SELECT agent,COUNT(*)as n,ROUND(AVG(opCount))as ops,SUM(CASE WHEN status='error'THEN 1 ELSE 0 END)as errs FROM sessions WHERE startedAt>?GROUP BY agent\").all(Date.now()-6*3600000);console.table(r);const hi=db.query(\"SELECT agent,opCount,task FROM sessions WHERE startedAt>? AND opCount>30 ORDER BY opCount DESC LIMIT 5\").all(Date.now()-6*3600000);console.log('\\nHigh-op sessions:');for(const s of hi)console.log(s.agent,s.opCount+'ops',s.task?.slice(0,80))"
```

### Exploration Modes

- **Mode A: Session Archaeology** — Dig into recent sessions, find pain points, identify automation opportunities
- **Mode B: Tool Gap Analysis** — Find multi-step bash patterns that should be tools
- **Mode C: Skill & Technique Scouting** — Review scout findings, compare high/low performing sessions
- **Mode D: Workflow Health** — Check workflow adoption, success rates, overhead

### Workflow Routing

| Work type | Workflow |
|-----------|----------|
| Building a new tool/skill | `workflow.run('implement-and-verify', task)` |
| Investigation needing a fix | `workflow.run('investigate-and-fix', task)` |
| All other forked work | `workflow.run('verify-wrap', task)` |
| Multi-question analysis | `workflow.run('parallel-research', JSON.stringify({...}))` |

### Fork Template
```javascript
workflow.run("verify-wrap", `[WORK SESSION] <specific task>
Objective: <done state>
Hypothesis: <what improves, how to measure>
Read: <specific files>
Deliverable: Write results to <specific file path>.`)
```

### Finding Conversion — Dispatch, Don't Just Log
Only ~7% of findings become deployed fixes. When a Mode B or C analysis produces a finding with a specific, actionable fix:
1. Fork a tech-lead or coder session with fix details BEFORE the cycle ends
2. Note in todo.md: "Dispatched: <finding> → tech-lead (<date>)"
Skip dispatch only if: observational (no clear fix), needs design discussion, or already tracked.

### Cross-Cycle Dispatch
```javascript
agents.message({ agent: "tech-lead", message: "Finding: [summary]. Fix: [action]. Files: [paths]. Evidence: [what you measured]." })
```
Rules: Must be concrete. Don't use for <3 op fixes. Route system-scope changes through May.

### Rules for Building (in forked sessions)
- Always measure before AND after. No baseline = no evidence.
- One improvement per session. Don't stack changes.
- Write results to `agents/shared/knowledge/experiments/` or `agents/shared/knowledge/entries/`.

### Quick Inline vs Must-Fork
**Inline OK:** Updating todo.md, acknowledging dispatch, checking single metric.
**Must fork:** Multi-query DB analysis, tool gap analysis, skill scouting, workflow health checks, any building/coding/experimentation, reading experiment results.

### Monthly Code Hygiene
If >30 days since last cleanup (`git log --oneline --grep="code cleanup" -1`), flag a code hygiene audit.
