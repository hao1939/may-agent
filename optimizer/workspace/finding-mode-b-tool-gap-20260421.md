# Mode B: Tool Gap Analysis — 2026-04-21

## Scan Parameters
- **Window**: Last 6 hours (cutoff: ~20:10 UTC Apr 20)
- **Sessions analyzed**: 158 (with bash commands)
- **Total bash commands**: 1,672
- **Top agents by ops**: scout 271, amy 270, coach 192, tech-lead 163, qa 149, optimizer 129

## Dedupe Check vs. Prior Findings
Previously documented patterns (NOT repeated here):
- **Ad-hoc bun:sqlite DB querying** (01:00, 03:00, 05:00 Apr 18 findings) — P1 pattern, held due to KE-026 adoption ceiling
- **Transcript/session.jsonl inspection** (23:00 Apr 17) — held pending gym-batch `--inspect`
- **cron.json jq chains** (Apr 20 finding) — task-specific, nearly done
- **code-search.ts / session-query.ts zero adoption** (all prior findings) — Level-4 adoption ceiling confirmed repeatedly

## NEW Patterns Found

### Pattern 1: Heartbeat Context Gathering Ritual
**48 sessions | 312 ops | All cron/heartbeat agents**

Every heartbeat session opens with a near-identical 4-7 command sequence:
```
cat agents/<agent>/context.md | head -80
ls agents/<agent>/workspace/
cat agents/<agent>/workspace/todo.md | head -60
cat agents/<agent>/workspace/heartbeat.md | head -80
ls .state/checkpoints/<agent>* 
cat .state/checkpoints/<agent>-latest.json
```

This is the single largest ops sink by volume: **312 ops across 48 heartbeat sessions in 6h**. Every agent does this every heartbeat. It's pure boilerplate — the agent always needs the same context bundle.

**Ops wasted estimate**: ~4-5 ops/session × ~48 sessions/6h = **~220 ops/6h** (subtracting 1 op that would remain for a bundled read). Extrapolated: **~880 ops/day**.

**Tool opportunity**: A `heartbeat-context` script or handler-level injection that pre-bundles `context.md + todo.md + recent checkpoint + workspace listing` into a single blob passed to the agent prompt. This would be **Level-1** (handler integration), avoiding the KE-026 adoption ceiling. The heartbeat handler already exists — it could simply include the context bundle in the system prompt.

**Assessment**: **HIGH ROI** — eliminates ~880 ops/day with a handler-level change. No adoption risk since it's injected, not opt-in.

### Pattern 2: Path Hallucination Recovery Loops
**18 sessions | 39 wasted commands**

Agents emit commands with wrong base paths (`/home/user`, `/Users/jm/Developer/c3`, etc.), get blocked by the PATH_HALLUCINATION guard, then retry. Most common in:
- amy (gym scenario sessions): `cd /home/user && cat ROOT_CAUSE_ANALYSIS.md` → blocked → retry with `/app`
- optimizer: `cd /Users/jm/Developer/c3 && ...` → blocked → retry

The guard catches them, but each hallucination costs 2 ops (failed attempt + retry). In amy's gym sessions this is particularly bad — **7 of 18 affected sessions are amy**, with 2-3 hallucinations each.

**Ops wasted estimate**: 39 failed commands + 39 retries = **~78 ops/6h wasted**. Extrapolated: ~312 ops/day.

**Tool opportunity**: Not a tool gap — this is a **prompt/context gap**. The gym scenario environment could include a stronger path hint in the system prompt. Alternatively, the PATH_HALLUCINATION guard could auto-rewrite `cd /home/user && <cmd>` to `cd /app && <cmd>` instead of blocking, saving the retry op.

**Assessment**: **MEDIUM ROI** — auto-rewrite in the guard would halve the waste (39 ops/6h saved). Low implementation cost.

### Pattern 3: Knowledge Library Discovery Chains
**20 sessions | 129 ops | Primarily scout + bob**

Scout and bob repeatedly probe the knowledge library structure:
```
ls agents/shared/knowledge/library/deep-dives/ | head -20
grep "CR-29\|CR-34" agents/shared/knowledge/library/deep-dives/INDEX.md
ls agents/shared/knowledge/library/deep-dives/CR-33* CR-34*
tail -50 agents/shared/knowledge/library/deep-dives/INDEX.md
cat agents/shared/knowledge/library/deep-dives/covered_ids.txt
```

The pattern: check INDEX.md → check covered_ids.txt → ls for specific prefixes → read individual files. This 3-5 step sequence repeats because there's no single query interface for "what do we know about topic X?" or "is paper Y already covered?"

**Ops wasted estimate**: ~3-4 ops/session × 20 sessions = **~65 ops/6h**. Extrapolated: ~260 ops/day.

**Tool opportunity**: A `knowledge-search` script: `bun scripts/knowledge-search.ts "CR-344"` → returns whether it exists, its path, and first 20 lines. Could also support `--uncovered` to list gaps. This is Level-4 (CLI), which has the adoption ceiling problem. Better: extend the scout heartbeat handler to pre-load the INDEX.md and covered_ids into context (Level-1).

**Assessment**: **LOW-MEDIUM ROI** — smaller volume, and the adoption ceiling makes a CLI risky. Handler injection is better but scout-specific.

### Pattern 4: Defensive Null-Check Proliferation
**76 sessions | 575 ops**

The single most common bash micro-pattern is `2>/dev/null` appended to file reads:
```
cat agents/coach/workspace/todo.md 2>/dev/null | head -60
ls .state/checkpoints/tech-lead* 2>/dev/null
```

76 of 158 sessions (48%) have ≥3 commands with `2>/dev/null`. This isn't exactly "wasted" — the commands succeed when files exist — but it signals that agents don't know what files exist before probing. The overhead is the commands that return empty (file doesn't exist), estimated at ~15-20% of these 575 commands = **~100 wasted ops/6h**.

**Tool opportunity**: Not directly addressable by a tool. This is a symptom of agents lacking a workspace manifest. A `workspace-manifest.json` auto-generated on each commit (listing all agent workspace files) would let agents skip probing. But this is architectural, not a quick tool fix.

**Assessment**: **LOW ROI for a tool** — the defensive pattern is cheap per-instance and hard to eliminate without architectural changes.

## Summary Table

| # | Pattern | Sessions | Ops/6h | Ops Wasted/6h | Tool Fix | ROI | Previously Documented? |
|---|---------|----------|--------|---------------|----------|-----|----------------------|
| 1 | Heartbeat context gathering | 48 | 312 | ~220 | Handler-level context bundle (Level-1) | **HIGH** | No |
| 2 | Path hallucination recovery | 18 | 78 | ~78 | Auto-rewrite in guard | **MEDIUM** | No |
| 3 | Knowledge library discovery | 20 | 129 | ~65 | knowledge-search script or handler injection | **LOW-MED** | No |
| 4 | Defensive null-check proliferation | 76 | 575 | ~100 | Workspace manifest (architectural) | **LOW** | No |

## Recommendation

**DISPATCH Pattern 1** — Heartbeat context bundle injection. This is the highest-ROI opportunity found in any Mode B scan to date:
- **~880 ops/day** eliminated
- **Level-1 integration** (handler change, no adoption risk)
- **All agents benefit** (universal heartbeat pattern)
- Implementation: modify the heartbeat handler to read and inject `context.md + todo.md + workspace listing + latest checkpoint` into the agent's initial prompt, eliminating the 4-7 bash commands every heartbeat currently spends gathering this.

**HOLD Patterns 2-4** — Lower ROI or architectural scope.

## Dispatch Readiness

- **What**: Add context bundle pre-loading to heartbeat handler
- **Where**: Likely `src/lib/workflows/heartbeat.ts` or equivalent handler entry point
- **Estimated effort**: Small (read 3-4 files, concat, inject into prompt)
- **Risk**: Low — read-only context injection, no behavioral change
- **Verification**: Post-deploy, Mode B rescan should show heartbeat sessions dropping from ~6-7 bash ops to ~2-3
