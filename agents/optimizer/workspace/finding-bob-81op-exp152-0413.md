# Finding: Bob 81-op EXP-152 Phase 2 Design Session

**Date**: 2026-04-13  
**Session**: `s_1776093729020_253`  
**Agent**: bob  
**Op count**: 81  
**Duration**: 13 min (15:22–15:35 UTC)  
**Pattern**: Experiment design session (bare fork, no workflow)

---

## Summary

The 81-op session designed EXP-152 Phase 2 — a targeted fork-scenario pairing experiment testing guard artifacts as environmental memory (H-108). **This is a legitimate high-op session, not waste.** The session produced substantial, well-structured output and represents a genuinely complex design task.

## What the session produced

1. **phase2-design.md** — 283-line comprehensive experiment design document (committed at 15:32)
   - Confound analysis of Phase 1 (SOUL.md confound, wrong skill removals, overly broad removal)
   - 3-condition matrix (production, no-rbe-v2, no-verify-v2)
   - Scenario selection with power analysis
   - Error recurrence analysis framework
   - Full procedure with shell scripts
   - Sample size calculations (110 trials)
   
2. **phase2-validate.sh** — 28-line validation script (committed at 15:34)

3. **Minor updates** — design.md status, H-108 hypothesis file, todo.md

Total: ~315 lines of new content across 4 files.

## Op breakdown estimate

| Activity | Est. ops | Justification |
|----------|----------|---------------|
| Read 5 context files (task specifies: todo.md, design.md, phase1-analysis.md, KE-169, H-108) | ~10 | Standard for a 5-file read list |
| Analyze Phase 1 confounds (SOUL.md, wrong removals) — requires reading production coder config, lab forks, agent loader code | ~15-20 | Discovering SOUL.md confound requires tracing resolveSystemPrompt() in manager.ts |
| Scenario selection (checking gym baselines, pass rates) | ~10-15 | Querying gym-results DB, reviewing scenario metadata |
| Write 283-line design document | ~15-20 | Large structured document with tables, bash scripts, analysis framework |
| Create lab fork specs + validate.sh | ~5-8 | Shell scripting |
| Git commit + verification | ~5-8 | Standard |
| **Total estimate** | **~60-80** | Matches actual 81 |

## Classification: **Known pattern — not actionable**

### Why 81 ops is reasonable here

1. **Genuinely complex task**: Redesigning an experiment after Phase 1 confound discovery requires:
   - Reading the failed Phase 1 results
   - Tracing the production coder's SOUL.md loading path through code
   - Verifying what skills/context actually get injected
   - Designing controlled conditions that fix 3 specific confounds
   - Specifying power analysis and stopping rules
   
2. **Productive output**: 283 lines of design document + 28-line validate.sh = 311 lines. At 81 ops, that's ~3.8 lines/op. By contrast, the 69-op KE-002 session produced 182 lines (~2.6 lines/op). This session is *more* efficient per line.

3. **No obvious waste patterns**:
   - Not restart-accumulated (single 13-min session)
   - No child sessions spawned
   - Not a workflow (bare fork)
   - No read loops visible (session duration / op count suggests ~10 sec/op, consistent with productive read-think-write cycle)

4. **Comparable to other experiment design sessions**: Bob's `s_1775899503711_1335` (EXP-134 design) was 67 ops. Design sessions that require confound analysis and controlled condition specification are inherently heavier than simple KB integration (19 ops for Phase 1 result processing).

### Why no workflow was used

The session was dispatched via `agents.fork()` (not `workflow.run('verify-wrap', ...)`), which means no D-o-R Phase 1 budget cap applied. This is actually appropriate — D-o-R's Phase 1 15-op cap would have been too restrictive for this type of exploratory design work that requires reading production code paths and verifying confounds.

**However**: Bob's heartbeat.md says to use `verify-wrap` for "experiment design" tasks. The decision to use bare fork avoided the Phase 1 cap but also missed verification guardrails. Given the session was productive, this is a minor concern.

## Broader EXP-152 cost picture (Apr 13)

| Session | Ops | Task |
|---------|-----|------|
| Phase 1 results analysis | 19 | Process interim results |
| **Phase 2 design** | **81** | **This session** |
| Phase 2 validation run #1 | 28 | Run validate.sh (still running) |
| Phase 2 validation run #2 | 34 | Run validate.sh (completed) |
| Heartbeats (3) | 7 | Dispatch only |
| Synthesis + DD integration | 31 | Related research |
| **Total EXP-152 today** | **205** | Full experiment pipeline |

The 81-op design session is 40% of the day's EXP-152 cost. But the design quality appears high — it identified 3 Phase 1 confounds and fixed all of them in the Phase 2 design.

## Actionability: LOW

**No fix needed.** This is not experiment design *bloat* — it's experiment design *complexity*. The task genuinely required:
- Confound forensics (tracing SOUL.md loading through code)
- Controlled condition specification
- Power analysis
- Error recurrence framework design
- Shell script generation

Compare to the coach 82-op session (QA regression investigation for EXP-133) which spent 69 ops debugging model issues that weren't coach's job. This session's ops were all on-task.

### One observation for the record

The follow-up validation sessions (28 + 34 = 62 ops) were **duplicate dispatches** of the same task. Bob's heartbeat at 15:52 and 16:22 both dispatched "EXP-152 Phase 2 — Run validation trials and create dispatch plan" because the first was still running. This is a minor request-deduplication gap (the pending request was visible but a new fork was created anyway). Cost: ~28 extra ops. Not worth a fix — this is a rare case of long-running validation runs overlapping with heartbeat dispatch cycles.

---

**Bottom line**: 81 ops for a 283-line experiment design document with confound analysis, power calculations, and infrastructure scripts is reasonable. This is a **known pattern** (complex experiment design sessions are inherently expensive) and **not a new cost driver** worth fixing.
