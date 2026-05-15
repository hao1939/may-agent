# EXP-740 Phase 1 Results + Phase 3 Fix Proposal

**Date**: 2026-05-04
**Status**: PHASE 1 COMPLETE + FIX DESIGNED

## Phase 1: Gate Liveness Confirmed Dead

### Evidence
- `agents/shared/duration-gate-triggers.log` — does not exist (0 entries)
- `agents/shared/impact-gate-triggers.log` — does not exist (0 entries)
- `agents/shared/exp720-fewshot-dryrun.log` — does not exist (0 entries)

### Session Denominator
Recent last-session.md timestamps show active sessions from 15 agents. Session durations range from 10s (evaluator) to 5m57s (amy-kimi). Multiple sub-2-minute sessions observed (scout 32s, qa 33s, amy 57s, coach 1m22s, may 1m22s, bob 1m37s).

### Expected vs Actual Trigger Rate
- EXP-710 found 50% shallow rate (5/10 sessions)
- Expected duration gate triggers: ~50% × sessions since deployment = many
- Actual: 0 triggers
- **H1 CONFIRMED**: Duration gate has 0% trigger rate despite 50% shallow rate
- **H2 CONFIRMED**: Impact gate has 0% trigger rate

### Root Cause (confirmed from code reading)
The gate pipeline in `heartbeat-data.ts` is sequential:
1. **Line ~440**: Artifact gate (EXP-520) checks `!hasDeliverables && !mentionsWrite`
2. **Line ~460**: Duration gate (EXP-630) checks `substanceScore < 5`
3. **Line ~525**: Impact gate (EXP-650) checks `didMultipleEdits && !grepMentions`

Problem: Gate 1 fires and re-prompts → agent produces deliverables + summary → Gate 2 sees inflated scores. Also, `turnsUsed` is always 0 (ctx.runAgent never populates it), so +3 bonus never applies.

For impact gate: regex `/\b(grep|rg |ripgrep|find\s.*-name)\b/i` matches virtually all sessions that run bash commands.

## Phase 3: Proposed Fix — Wall-Clock Duration Gate

### Why Wall-Clock Time
- EXP-705 confirmed: ALL shallow sessions <60s, ALL substantive >90s
- Clean binary signal — no proxy scoring needed
- Trivially measurable with `Date.now()`
- Independent of artifact gate (can't be inflated by re-prompt)

### Concrete Code Change

In `heartbeat-data.ts`, add BEFORE the `runAgent` call (~line 437):

```typescript
const heartbeatStartTime = Date.now();
```

Then REPLACE the entire EXP-630 duration gate block (lines 460-520) with:

```typescript
// ── EXP-740: WALL-CLOCK DURATION GATE ──────────────────────────────
// EXP-705/710: Sessions <60s are always shallow. >90s always substantive.
// Uses wall-clock time instead of proxy scoring (EXP-730: proxy scoring is dead code).
const elapsedMs = Date.now() - heartbeatStartTime;
const elapsedSec = Math.round(elapsedMs / 1000);
const TOO_FAST_THRESHOLD_SEC = 90;

if (elapsedSec < TOO_FAST_THRESHOLD_SEC && result.status !== "error") {
  ctx.emit({ type: "duration_gate_triggered", agent, elapsed_sec: elapsedSec });
  try {
    const logLine = `${new Date().toISOString()} agent=${agent} elapsed_sec=${elapsedSec} summary_len=${summaryLength} deliverables=${deliverableCount}\n`;
    appendFileSync(join(agentsRoot, "shared", "duration-gate-triggers.log"), logLine);
  } catch (_) { /* non-critical */ }

  const durationPrompt = `⚠️ DURATION GATE: Your session completed in ${elapsedSec}s — under the ${TOO_FAST_THRESHOLD_SEC}s minimum.

Fast sessions almost never produce meaningful work. Before finishing:
1. Did you investigate at least one non-obvious issue?
2. Did you produce an artifact with real analysis (not just a status echo)?
3. Did you check for improvement opportunities beyond surface metrics?

Dig deeper into one project or metric and produce a substantive artifact.`;

  const durationResult = await ctx.runAgent(agent, durationPrompt);
  recordOutcome(agentsRoot, agent, durationResult.status === "error",
    durationResult.status === "error" ? "duration gate re-prompt error" : undefined);
  return ctx.done(ctx.summarize(durationResult, { maxLength: 500 }));
}
```

### Risk Assessment
- **False positives**: A genuinely fast meaningful session would get re-prompted. Low risk — sub-90s meaningful sessions are rare (0% in EXP-705 sample).
- **Interaction with artifact gate**: Wall-clock time includes artifact gate re-prompt time, so if artifact gate fires + agent spends 60s on recovery, total could exceed 90s. This is GOOD — the combined gates ensure both deliverables AND depth.
- **Performance**: Negligible — one `Date.now()` call.

### For Impact Gate (EXP-650)
Separate fix needed — recommend EXP-735 approach (check for impact-related terms, not just any grep). Lower priority since duration gate would catch most shallow sessions.

## Recommendation

**Escalate this code change to tech-lead as P1.** The current duration gate is confirmed dead code with zero triggers. Wall-clock time is the simplest, most reliable signal available.
