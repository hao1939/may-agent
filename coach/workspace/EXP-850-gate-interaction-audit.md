# EXP-850: Gate Interaction Audit — Early-Return Suppression Analysis

## Problem
All 4 production gates (Artifact, Anti-Shallow, Impact, Duration) use early-return after re-prompt. Only ONE gate fires per session. The execution order is:

1. **Artifact Gate** (EXP-520) — fires if 0 deliverables + no write mention
2. **Anti-Shallow Gate** (EXP-725) — fires if tool_call_count < 10
3. **Impact Gate** (EXP-735) — fires if ≥2 edits + no impact search
4. **Duration Gate** (EXP-740) — fires if elapsed < 90s

If Gate 1 fires, Gates 2-4 are **never evaluated**. This means:
- A session with 0 deliverables AND <10 tool calls → only artifact gate fires
- A session with 3 edits, no impact check, AND <90s → only impact gate fires
- Duration gate is LAST — most likely to be suppressed

## Hypothesis
- **H1**: Duration gate (Gate 4) fires in ≤20% of sessions where elapsed < 90s, because upstream gates catch them first
- **H2**: Anti-shallow gate (Gate 2) catches most shallow sessions before duration gate has a chance
- **H3**: The current ordering is CORRECT — earlier gates address root causes (no artifact, too few calls) while duration is a fallback signal

## Analysis (from code review)

### Gate Firing Logic
```
if (no deliverables) → artifact re-prompt → RETURN
if (tool_calls < 10) → anti-shallow re-prompt → RETURN  
if (edits ≥ 2 && no impact check) → impact re-prompt → RETURN
if (elapsed < 90s) → duration re-prompt → RETURN
return done(result)  // only if ALL gates pass
```

### Likely Interaction Patterns

| Session Profile | Gate That Fires | Suppressed Gates |
|----------------|-----------------|------------------|
| Fast + empty (0 deliverables, <10 calls, <90s) | Artifact | Anti-Shallow, Duration |
| Fast + shallow (has deliverables, <10 calls, <90s) | Anti-Shallow | Duration |
| Fast + deep (has deliverables, ≥10 calls, <90s) | Duration | None |
| Multi-edit + no scan (≥2 edits, no grep) | Impact | Duration (if also fast) |
| Substantive (deliverables, ≥10 calls, ≤1 edit, ≥90s) | None | — |

### Assessment: Is This a Problem?

**Likely NO.** The ordering is sensible:
1. If you have no artifact, that's the #1 problem — fix it first
2. If you have <10 tool calls, you're shallow — deepen first
3. Impact check is a specific behavior check for multi-edit sessions
4. Duration is a fallback for sessions that pass above checks but are still fast

The only concern: **post-re-prompt, the session ends.** So if artifact gate fires, the agent gets ONE more chance but anti-shallow/impact/duration aren't checked on the re-prompted output.

### Recommendation
- **Current design is acceptable** for launch monitoring period
- **Future improvement** (if trigger data shows many double-violations): chain gates so re-prompt output is also checked
- **No action needed now** — monitor trigger logs for 50+ sessions first

## Status: ANALYSIS COMPLETE — No Intervention Needed
The gate ordering is correct by construction. Duration gate suppression is expected and acceptable because earlier gates address more fundamental issues. Revisit after trigger data accumulates.

## Decision
- CLOSE as EXPECTED BEHAVIOR
- Monitor trigger distribution across gates to confirm H3
- If duration gate never fires while shallow rate remains high → investigate further
