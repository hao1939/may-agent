# Meta-Harness Feasibility Analysis

**Author**: Bob | **Date**: 2026-05-01 | **Source**: KE-081, improvement-queue

## Question

Can our system support a **meta-harness** — an outer loop that proposes hypotheses,
designs experiments, runs them, and updates the knowledge base without human intervention?

## Current Architecture Assets

| Component | Role in Meta-Loop | Readiness |
|-----------|------------------|-----------|
| Heartbeat dispatch | Triggers agent work cycles | ✅ Ready |
| Gym infrastructure | Runs controlled experiments | ✅ Ready |
| Knowledge base (KEs) | Stores validated findings | ✅ Ready |
| Hypothesis tracker | Tracks beliefs + priors | ✅ Ready |
| Bayesian scorecard | Updates confidence | ✅ Ready |
| Guard infrastructure | Enforces behavioral rules | ✅ Ready |
| Scout deep-dives | Surfaces external knowledge | ✅ Ready |
| Context updates (finish()) | Persists durable facts | ✅ Ready |

## Minimum Viable Meta-Harness Design

### Loop Structure

```
┌──────────────────────────────────────────────────────────┐
│  1. OBSERVE: Scan recent session outcomes for anomalies  │
│     (evaluator scores, error patterns, quality drops)    │
│                          ↓                               │
│  2. HYPOTHESIZE: Generate candidate explanations         │
│     (Bob proposes H-xxx with prior probability)          │
│                          ↓                               │
│  3. DESIGN: Create experiment protocol                   │
│     (EXP-xxx with arms, success criteria, sample size)   │
│                          ↓                               │
│  4. EXECUTE: Run via gym or production observation       │
│     (Coach runs trials, evaluator scores them)           │
│                          ↓                               │
│  5. ANALYZE: Bayesian update on hypothesis               │
│     (Bob computes posterior, writes KE if confirmed)     │
│                          ↓                               │
│  6. ACT: Deploy finding (guard, context update, skill)   │
│     (Tech-lead wires, optimizer verifies adoption)       │
│                          ↓                               │
│  [loop back to OBSERVE]                                  │
└──────────────────────────────────────────────────────────┘
```

### What Already Works (manually)

Steps 1-6 already happen — but with human-in-the-loop timing:
- Bob proposes hypotheses in heartbeats
- Coach runs experiments when dispatched  
- Bob writes KEs after results land
- Tech-lead deploys guards

The gap is **orchestration**: no single loop coordinates these steps end-to-end.

### What's Missing for Full Autonomy

1. **Experiment completion detection**: No reliable way to know "EXP-xxx finished all trials."
   Current state: Coach runs trials but results accumulate without a clear "done" signal.
   
2. **Automated hypothesis generation from data**: Bob currently generates hypotheses from
   intuition + scout findings. A meta-harness needs a systematic scan of failure patterns
   → candidate causes → testable predictions.

3. **Decision gate between steps**: Currently each step requires a heartbeat to notice the
   previous step completed. Need: event-driven triggers ("EXP done → analyze → act").

4. **Kill criteria**: When should the loop abandon a hypothesis? Current Bayesian scorecards
   lack explicit "stop investigating at P < 0.2" rules.

### Feasibility Assessment

| Requirement | Difficulty | Approach |
|-------------|-----------|----------|
| End-to-end orchestration | Medium | New cron job or project-type with step tracking |
| Experiment completion signal | Low | Write `results.json` with `status: complete` in gym |
| Auto-hypothesis from patterns | High | Requires pattern-matching over session logs |
| Event-driven step transitions | Medium | May's handler system could fire on file changes |
| Kill criteria | Low | Add `abandon_threshold` field to hypothesis files |

### Recommended MVP

**Phase 1** (achievable now): 
- Add explicit `status: complete` to experiment result files
- Add `abandon_threshold: 0.15` to hypothesis YAML
- Write a "meta-harness check" cron that Bob runs each heartbeat:
  scan for completed-but-unanalyzed experiments, trigger analysis

**Phase 2** (requires new infrastructure):
- Event handler: "experiment complete → fork Bob analysis session"
- Systematic failure-pattern scanner (optimizer already does pieces of this)

**Phase 3** (aspirational):
- Auto-hypothesis generation from recurring error patterns
- Full closed-loop with no human triggers needed

## Conclusion

The meta-harness is **feasible with current architecture** for Phase 1. The main missing
piece isn't capability — it's coordination. Our agents already do every step; they just
don't reliably chain them. The MVP is a lightweight polling loop that detects "experiment
done, analysis pending" states and dispatches the next step.

**Recommendation**: Implement Phase 1 as a Bob heartbeat checklist item. If it reduces
hypothesis-to-KE latency by >50%, design Phase 2 as a proper project.
