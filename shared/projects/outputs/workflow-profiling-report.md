# Workflow Profiling Report

Generated: 2025-01-27 | Analysis of 393 iterations across 9 satellite projects

## Summary

The slowest workflows by average iteration time are **test-coverage** (259s), **workflow-reliability** (235s), and **agent-system-literacy** (163s). The fastest is **documentation-gen** (66s). The primary bottleneck across all workflows is **file I/O in project.ts** (33 filesystem/parse operations), which every iteration calls multiple times.

## Per-Project Iteration Timing

| Project | Iterations | Avg (s) | P90 (s) | Min (s) | Max (s) |
|---|---|---|---|---|---|
| test-coverage | 14 | 259 | 306 | 53 | 1503 |
| workflow-reliability | 25 | 235 | 223 | 42 | 2172 |
| agent-system-literacy | 86 | 163 | 301 | 6 | 3295 |
| request-deduplication | 4 | 154 | 212 | 97 | 212 |
| system-efficiency | 56 | 132 | 235 | 42 | 1501 |
| skill-workflow-audit | 93 | 103 | 217 | 7 | 859 |
| handler-reliability | 2 | 86 | 86 | 86 | 86 |
| agent-memory-learning | 53 | 83 | 212 | 8 | 1201 |
| documentation-gen | 60 | 66 | 139 | 6 | 1340 |

## Bottleneck Analysis

### 1. project.ts — Heaviest File I/O (33 filesystem calls)
`project.ts` (1046 lines) performs 33 `readFile`/`writeFile`/`JSON.parse` operations. Every iteration reads `project.md`, `journal.md`, parses metrics, writes updates. This is called on every single iteration of every project.

**Optimization**: Cache parsed project data in memory within a single master-worker run. Currently each helper function re-reads and re-parses the same files. A `ProjectCache` that loads once and flushes on write would eliminate ~60% of redundant reads.

### 2. master-worker.ts — Sequential LLM + Validation
`master-worker.ts` (506 lines) runs dispatch validation, then LLM call, then output verification sequentially. The dispatch-validator reads project.md (already read by the orchestrator). The verify-wrap step re-reads files that were just written.

**Optimization**: Pass already-parsed project data through the pipeline instead of re-reading from disk at each step. Estimated savings: 2-3 file reads per iteration.

### 3. High Variance = Retry/Timeout Issues
Projects with high max times (agent-system-literacy: 3295s, workflow-reliability: 2172s) indicate iterations that hit retries or timeouts. The circuit-breaker should be tuned: current thresholds may allow too many retries before tripping.

**Optimization**: Reduce circuit-breaker `maxFailures` from default to 2 for non-critical operations. Add a per-iteration hard timeout of 600s.

### 4. Workflow File Complexity

| File | Lines | I/O Calls | Risk |
|---|---|---|---|
| project.ts | 1046 | 33 | HIGH — most complex, most I/O |
| master-worker.ts | 506 | 9 | MEDIUM — orchestration overhead |
| heartbeat-data.ts | 413 | 8 | MEDIUM — periodic polling |
| fewshot-inject-helpers.ts | 162 | 0 | LOW — pure computation |
| circuit-breaker.ts | 159 | 0 | LOW — in-memory state |

## Concrete Optimization Recommendations

### Priority 1: ProjectCache (estimated 40% I/O reduction)
```typescript
class ProjectCache {
  private cache = new Map<string, { data: any; mtime: number }>();
  
  async read(path: string): Promise<string> {
    const stat = await fs.stat(path);
    const cached = this.cache.get(path);
    if (cached && cached.mtime >= stat.mtimeMs) return cached.data;
    const data = await fs.readFile(path, 'utf-8');
    this.cache.set(path, { data, mtime: stat.mtimeMs });
    return data;
  }
}
```
Pass a single `ProjectCache` instance through the master-worker pipeline. Each iteration creates one, uses it for all reads, discards after write.

### Priority 2: Pipeline Data Passing
Instead of:
```
validateDispatch() → reads project.md
masterWorker()    → reads project.md again
verifyOutput()    → reads project.md again
```
Do:
```
projectData = readProject()
validateDispatch(projectData)
masterWorker(projectData)
verifyOutput(projectData)
```

### Priority 3: Circuit-Breaker Tuning
- Set `maxFailures = 2` (down from default)
- Add `iterationTimeout = 600_000` (10 min hard cap)
- Log circuit state transitions for observability

## Expected Impact

| Optimization | Estimated Savings | Effort |
|---|---|---|
| ProjectCache | -40% file I/O per iteration | 2 hours |
| Pipeline data passing | -2-3 reads per iteration | 1 hour |
| Circuit-breaker tuning | -50% max iteration time | 30 min |
| **Combined** | **~30% faster average iteration** | **3.5 hours** |

## Conclusion

The biggest win is reducing redundant file reads in `project.ts`. Every iteration currently reads the same files 3-5 times through different helper functions. A simple caching layer would cut I/O by 40% and reduce average iteration time by an estimated 30%. The circuit-breaker tuning addresses the long-tail outliers that inflate p90 times.
