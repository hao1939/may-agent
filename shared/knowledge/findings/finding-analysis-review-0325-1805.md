# Analysis Review — 2026-03-25T18:05

## Deep Pattern Scan (30+ sessions reviewed)

### System Health Summary

| Metric | Value | Trend |
|--------|-------|-------|
| Session rate | 9.4/hr | ✅ Stable (was 25+/hr pre-optimization) |
| Waste rate | 3.8% | ✅ Down from 5.4% |
| QA waste | 4.2% | ✅ -89% after npx fix |
| Bob waste | 13.0% | ⚠️ Highest among agents |
| Zombie sessions | 39 stuck | 🔴 Blocked on restart |
| Running binary | b9ef77e | 🔴 6+ commits behind symlink (f4b83c6) |
| Skills deployed | 18 | ✅ Active |
| meta.json cost | $0.00 everywhere | 🔴 Tracking broken |

### Key Findings

#### 1. 🔴 P0: Process Restart Blocked (Critical)
Running binary is `may-agent-b9ef77e` (built Mar 24). Symlink points to `may-agent-f4b83c6` (built Mar 25 16:04). The running process is **6 commits behind**:
- `1d58bd5`: zombie cleanup handler + improvements
- `37b8fbb`: wire limit param to agents("requests")
- `786c884`: Path Assumption Guard
- `7b1487c`: fix 30 test failures
- `ada9b0c`: verification-evidence gym scenario
- `f4b83c6`: restore DOMAIN.md loading
- `52093fa`: restore LESSONS.md loading

**Impact**: Zombie cleanup handler exists on disk but can't be discovered by old binary (handlers loaded at startup). 39 zombie sessions accumulating. Multiple bug fixes not active.

**Action**: Restart request already sent (req:31d94ce6). Escalating again.

#### 2. ⚠️ P1: Bob Doing Coding Instead of Delegating
Bob's 13% waste rate traced to a pattern: reads large source files (50KB+ manager.ts), attempts edits that fail (produces identical content), then reads package.json and agent.json to understand build system. **This is coder work, not analyst work.**

Evidence: Session s_257: read src/lib/manager.ts (50KB), failed edit (no changes), read package.json, read agent.json. Also session s_233: agents(filter:"all") returned 324KB.

**Proposed fix**: Add to Bob's heartbeat.md or SOUL.md:
```
⚠️ You are NOT a coder. Never edit files in src/. If you identify a code change needed, delegate to coder via agents.send("tech-lead", ...) with a clear brief.
```

#### 3. ⚠️ P1: Evaluator Workspace References Stale Files
Evaluator sessions hitting 10 errors in 2 sessions: ENOENT for nonexistent workspace files, edit-match-fail, python not found. The evaluator tries to read/edit files that don't exist or have changed.

**Proposed fix**: Evaluator heartbeat needs workspace directory check before acting on stale references.

#### 4. 🟢 INFO: Evaluator Heuristic Working Well
JS-based evaluation heuristic is producing 0-op sessions frequently — the LLM-free fast path is working. Multiple evaluator sessions show ops=0, meaning the heuristic correctly identified "no LLM needed" cases.

#### 5. 🟢 INFO: QA npx Fix Confirmed
QA SOUL.md updated to use `./node_modules/.bin/tsc` and `./node_modules/.bin/vitest`. 0 waste in 8/9 recent QA sessions. Estimated savings: ~$5-10/day.

#### 6. 🟢 INFO: Scout Synthesis Loop Fixed
Scout down to 2 sessions in 6.5h (was 32/day before fix). The synthesis loop fix is holding.

### Actionable Next Steps
1. **P0**: Escalate restart request. Binary f4b83c6 needs to be activated.
2. **P1**: Fix Bob's role boundary — add "no source edits" guard to Bob's SOUL.md
3. **P1**: Clean up evaluator stale workspace references
4. **P2**: Track down meta.json cost tracking bug (PersistedSession interface missing usage field)
