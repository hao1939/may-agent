# Coach Reference

### Running-Session Guard (check before forking)
```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
const running=db.query(\"SELECT sessionId,task,datetime(startedAt/1000,'unixepoch')as started FROM sessions WHERE agent='coach' AND status='running' AND task LIKE '%WORK SESSION%'\").all();
if(running.length>0){console.log('⛔ BLOCKED — work session already running:');running.forEach(s=>console.log('  '+s.started+': '+s.task.substring(0,80)));console.log('DO NOT FORK. Wait for it to finish.')}else{console.log('✅ No running work sessions. Safe to fork.')}
"
```

### Phase Structure for Experiment Work Sessions

| Phase | What | Gate to next phase |
|-------|------|--------------------|
| **1. Design** | Read context, define hypothesis, success criteria, metrics | Hypothesis + criteria written |
| **2. Setup** | Create scenario, configure baseline, prepare gym | Scenario runnable, baseline defined |
| **3. Run** | Execute gym scenarios (baseline + treatment) | Raw results captured |
| **4. Analyze** | Compare results, compute metrics, write finding | Finding written |
| **5. Graduate/Reject** | Update EXP-XXX status, promote skill or reject hypothesis | Status updated |

Phase rules:
- Checkpoint between phases. If running long after Phase 3, checkpoint and finish.
- Write as you go — each phase produces a written artifact.
- Phase 1 cap: 5 ops.
- Never skip Phase 5.

### Work Session Examples

**Growth cycle:**
```javascript
workflow.run("growth-cycle", "Test classify-before-destructive-action skill on sycophants-dilemma scenario. Baseline is 3/6. Target: >4/6. Write summary to workspace/growth-receipts/")
```

**Training sprint:**
```javascript
workflow.run("training-sprint", "Scan ERROR_LOGs for patterns, test methods against: misleading-test-fix, regression-from-fix, search-strategy-escalation. Max 3 growth-cycles. Write summary to workspace/")
```

**Investigation with findings:**
```javascript
workflow.run("verify-wrap", "Analyze C1.1 system-wide regression. Query .state/may.db for C1.1 pass rates by day, by agent. Output: agents/coach/workspace/brief-c11-regression-analysis.md")
```

**Scenario design:**
```javascript
workflow.run("verify-wrap", "Design gym scenario for error-cascade-diagnosis. Must have clear success criteria. Output: gym/scenarios/error-cascade-diagnosis-v2/")
```

**Skill regression testing:**
```
[WORK SESSION] Regression check: all promoted skills
Run each promoted skill's gym scenario once. Record pass/fail.
Output: Update workspace/todo.md Promoted Skills table.
```

### Quick Inline vs Must-Fork
**Inline OK:** Simple question response, brief todo.md update, single gym result check, acknowledging dispatch.
**Must fork:** ANY gym scenario, growth-cycle/training-sprint, error pattern analysis, scenario design, experiment writeup, skill verification, any task >5 ops.

### Efficiency Tips
- Count ops: each tool call = 1 op. Combine queries into single bash calls.
- Read todo.md ONCE. Don't re-read files already in context.
- Plan SQL queries first, run them all at once — avoid interactive query loops.

### Exit States
Session must end in one of: (a) dispatched work, (b) self-directed investigation with written file, (c) explicit short-cadence wait with named trigger.

Sources of work when nothing is dispatchable:
- Open IT items in recent reflections (status NOT STARTED or PARTIAL)
- Experiments with design but no results
- Untested hypotheses needing gym scenarios
- Convention regressions needing investigation
- Promoted skills not verified recently

---

