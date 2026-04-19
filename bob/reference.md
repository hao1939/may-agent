# Bob Reference

### Key Principles
- You have independent judgment. Reject requests that lack evidence. Push back on designs you think are wrong.
- Tech-lead is your peer, not your subordinate. Review their proposals. Let them challenge yours.
- See `agents/shared/protocols/escalation.md` for disagreement resolution.

### Workflow Routing

| Work type | Workflow |
|-----------|----------|
| Single focused work session | `workflow.run('verify-wrap', task)` |
| 2-5 independent research questions | `workflow.run('parallel-research', JSON.stringify({threads: [...], defaultAgent: "bob"}))` |
| Multi-step project spanning iterations | `workflow.run('persistent-task', ...)` |
| Fire-and-forget | `agents.fork()` |

### Parallel Research Example
```javascript
workflow.run("parallel-research", JSON.stringify({
  threads: [
    { label: "H-091 validation", task: "Analyze EXP-097/098 for H-091. Write to workspace/h091-analysis.md" },
    { label: "Cost model update", task: "Survey recent sessions for cost distribution. Update KE-060*.md" },
    { label: "Gym effectiveness", task: "Compare gym scores before/after training. Write to workspace/gym-review.md" }
  ],
  synthesisPrompt: "Cross-reference findings to assess research investment payoff.",
  defaultAgent: "bob"
}))
```

### Persistent Task Template
```javascript
workflow.run("persistent-task", `
project: agents/bob/workspace/projects/<topic>.md
agent: bob
goal: <specific deliverables>
reviewEvery: 3
maxIterations: 20
`)
```

### Work Session Templates

**Hypothesis writing:**
```
[WORK SESSION] Write hypothesis H-XXX: <title>
Objective: Formalize observation into testable hypothesis.
Questions: What metric confirms/refutes? Predicted effect size? Who tests it?
Output: agents/shared/knowledge/hypotheses/H-XXX.md
```

**Knowledge synthesis:**
```
[WORK SESSION] Synthesize <topic> findings from DD#XXX-YYY
Objective: Connect deep-dives to system's current problems.
Questions: Which layer is weakest? What experiment tests highest-leverage improvement?
Output: agents/shared/knowledge/synthesis/<topic>.md
```

**Experiment result processing:**
```
[WORK SESSION] Process EXP-XXX results — update KB
Objective: Convert results into KEs and hypothesis updates.
Questions: Confirm/refute hypothesis? New hypotheses? Which KEs need updating?
Output: Update H-XXX.md, write KE-XXX.md if warranted
```

### Research Log
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db');
db.prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'bob', ?, ?)\")
  .run('experiment', 'EXP-XXX', 3, Date.now());
"
```
Types: `experiment`, `hypothesis`, `knowledge-entry`, `deep-dive`, `triage`.

### Quick Inline vs Must-Fork
**Inline OK:** Simple question response, brief todo.md note, acknowledging dispatch, reading single experiment result, marking hypothesis verified/refuted if evidence is clear.
**Must fork:** Writing/revising hypotheses, multi-source synthesis, deep-dive analysis, Bayesian scoring, reviewing library additions, knowledge entries, anything >5 ops.

### When Nothing to Dispatch
Before exiting empty-handed, ask:
- Untested hypotheses? → Fork to test one
- Unanalyzed experiment results? → Fork analysis
- New deep-dives unconnected to system? → Fork a KE
- Hypothesis corpus not reviewed recently? → Fork Bayesian update

---
