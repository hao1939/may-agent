# Efficiency Scorecard — System Health & Dispatch Analysis

*Generated: Iteration 1 — Dispatch Waste Deep Dive*

## Current Metrics Summary

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Deliverables per iteration | ≥1 file | ≥1 | ✅ On target |
| Satellite status | All responsive | Operational | ✅ On target |
| Test health | Pass rate ≥95% | ≥95% | ✅ On target |
| **Dispatch accuracy** | ≥90% | **~3%** | ❌ **Critical** |

---

## Dispatch Waste Analysis

### The Numbers (from v3 tracking, last 200 runs)

| Outcome | Count | Percentage |
|---------|-------|------------|
| Error (never started) | 197 | 98.5% |
| Completed normally | 2 | 1.0% |
| Still running | 1 | 0.5% |

**Root cause**: Workers dispatched for projects that have no `project.md` → immediate error at `master-worker.ts` line ~190 → `ctx.escalate()` → 0 useful steps.

### Top Offending Dispatches

| Non-existent Project | Failed Dispatches |
|----------------------|-------------------|
| `agent-system-literacy` (wrong path) | 24 |
| `pwi-evaluator-tuning` (archived) | 23 |
| Various other archived/moved projects | ~150 |

### Why These Projects Don't Exist

1. **51 archived projects** in `projects/_archive/` — including `pwi-evaluator-tuning`, `agent-autonomy`, `metric-system`, etc. The dispatcher still references these.
2. **Path mismatches** — dispatching to `agents/bob/workspace/projects/X` instead of `agents/shared/projects/X`
3. **Only 16 active projects** currently exist in `agents/shared/projects/`

### The Math

- **16 active projects** vs **51 archived** = dispatcher has a ~24% chance of picking a valid project *if random*, but observed accuracy is ~3%, suggesting systematic bias toward stale entries.

---

## System Inventory

### Active Projects (16)
```
agent-convention-compliance    documentation-gen
agent-memory-learning          evaluation-revival
agent-system-literacy          gym-quality-improvement
coach-quality                  handler-reliability
hao-alignment                  proof-of-life-dashboard
request-deduplication          skill-workflow-audit
system-efficiency              test-coverage
workflow-reliability           (outputs dir)
```

### Archived Projects (51)
Including: `pwi-evaluator-tuning`, `metric-system`, `adaptive-heartbeats`, `context-learning`, `gym-leverage`, `master-worker-test`, `prove-the-loop`, and 44 others.

---

## Proposed Fix: Pre-flight Dispatch Validation

### Option A: Filesystem Check (Simplest)
```typescript
// In master-worker.ts, before spawning worker:
const projectMd = path.join(projectDir, 'project.md');
if (!fs.existsSync(projectMd)) {
  log.warn(`Skipping dispatch: ${projectId} has no project.md`);
  return; // Don't spawn worker
}
```

**Pros**: Zero config, always accurate
**Cons**: Filesystem I/O on every dispatch

### Option B: Active Project Registry
```json
// projects/active-projects.json
{
  "active": [
    "agent-convention-compliance",
    "workflow-reliability",
    "system-efficiency",
    ...
  ],
  "lastUpdated": "2026-04-12"
}
```

**Pros**: Fast lookup, explicit control
**Cons**: Must be maintained

### Recommendation: **Option A** (filesystem check)
- Simplest, self-maintaining, no drift risk
- Single line of defense eliminates 97% of wasted sessions
- Can add Option B later as optimization

### Expected Impact

| Metric | Before | After (projected) |
|--------|--------|-------------------|
| Dispatch accuracy | ~3% | ≥95% |
| Wasted sessions | ~197/200 | <10/200 |
| Effective throughput | ~1% of compute | ~90% of compute |
| Sessions to complete 1 real task | ~100 | ~1.1 |

This single fix would yield an estimated **30-90x improvement** in effective system throughput.

---

## Other Efficiency Observations

### Session Overhead
- Recovery logs show cascading retry storms (e.g., 10 consecutive `may` heartbeat failures from API issues)
- Each retry consumes a session slot → compounds the dispatch waste

### Recommendation Priority
1. **P0**: Add pre-flight project existence check (eliminates 97% waste)
2. **P1**: Clean up dispatcher's project list to remove archived references
3. **P2**: Add circuit breaker for API error retry storms
4. **P3**: Dashboard for real-time dispatch accuracy monitoring

---

*Data sources: v3-tracking-results.md, project filesystem inventory, recovery.jsonl*
