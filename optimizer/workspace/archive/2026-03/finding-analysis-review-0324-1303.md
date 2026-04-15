# Analysis Review — 2026-03-24T13:03

## Source Data
- 8 evaluations from `.state/evaluations/` (all from 2026-03-24, 08:33–10:34)
- Bob's analysis at `agents/bob/workspace/analysis.md` (updated 09:07)
- Session volumes from `meta.json` for 80 recent sessions

## Key Findings

### 1. FM-2.2 Instruction Noncompliance (dominant, 6/8 evals flagged)
- **Coach**: Asked to execute sprint plan → explored infrastructure instead (3 evals)
- **Optimizer**: Asked to write `workspace/skill-discovery.md` → produced different artifacts (3 evals)
- **Pattern**: Agents "improve" the task on-the-fly without completing the original requirement first
- **Impact**: result_delivered=false in 3/8 evaluations

### 2. FM-3.3 Verification Failure (persistent, 5/8 evals flagged)
- Agents claim results via `finish()` without inline tool evidence
- Specifically: optimizer claims "verified valid INDEX.md" with no read-back shown
- Coach claims "3/3 tests pass" without gym run outputs visible
- **Mitigation deployed**: finish() verification guard (22 tests, deployed 2026-03-24T10:10)
- **Effect TBD**: guard was deployed mid-cycle, newer sessions should show improvement

### 3. PATH_ASSUMPTION (3/8 evals, all different wrong paths)
- Coach: `/home/user` (wrong)
- Optimizer: `/var/lib/sessions`, `/var/tmp/sessions` (wrong)
- Optimizer Phase 3: `/Users/jk/aijudge` (wrong)
- **All are /app environment**. Structural guards exist in heartbeat.md but agents still guess.

### 4. C40 Promise-Deliver-Report missing (4/8 evals)
- Agents jump to tool calls without stating deliverables first
- No structured report mapping promises to evidence at end
- This is a process discipline issue, not a tooling issue

### 5. Session Volume (last 6h)
| Agent | Sessions | Total Ops | Avg Ops |
|-------|----------|-----------|---------|
| evaluator | 23 | 10 | 0.4 |
| coach | 8 | 169 | 21.1 |
| qa | 8 | 29 | 3.6 |
| coder | 6 | 70 | 11.7 |
| bob | 5 | 25 | 5.0 |
| may | 5 | 20 | 4.0 |
| optimizer | 2 | 90 | 45.0 |
| tech-lead | 2 | 80 | 40.0 |
| scout | 1 | 19 | 19.0 |

**Coach** remains highest ops consumer (169 ops/6h). Optimizer per-session cost is highest (45 ops/session avg).

## Comparison to Last Review (01:06)
- Previous: optimizer 53.7% of cost, $221/day total
- Now: coach has become the ops leader in last 6h while optimizer has only 2 sessions
- FM-3.3 remains the #1 quality issue — the finish() verification guard was deployed between reviews
- FM-2.2 instruction noncompliance is now more prominent than before — this is the next target

## Actionable Items
1. **Monitor finish() verification guard effectiveness** — check next eval cycle for FM-3.3 reduction
2. **Coach ops remain high** — 8 sessions × 21 ops avg = 169 ops in 6h. Previous escalation (req:8804a514, req:fd4d0e4b) to reduce coach heartbeat frequency sent but may not be implemented yet
3. **FM-2.2 needs a structural intervention** — the "instruction noncompliance" pattern is not addressed by any existing guard. Could be a new skill or a pre-flight checklist in heartbeat.md
