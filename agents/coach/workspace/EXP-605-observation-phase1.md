# EXP-605: Observation Phase — Session Duration Data (2026-05-03)

## Raw Data (Most Recent Session Per Agent)

| Agent | Duration | Summary | Likely Artifact? |
|-------|----------|---------|-----------------|
| evaluator | 9s | JSON output | ❌ No |
| may | 13s | Status note | ❌ No |
| master | 16s | CLI tools unavailable | ❌ No |
| judge | 25s | Criteria pass check | ❌ No |
| qa | 33s | Summary | ⚠️ Unknown |
| amy | 43s | Confirmed test result | ❌ No |
| tech-lead | 54s | Dismissed inbox, no artifact | ❌ No |
| scout | 58s | Synthesize findings | ⚠️ Possibly |
| optimizer | 1m5s | Status artifact | ✅ Yes |
| bob | 1m15s | Notification to may | ❌ No |
| coach | 2m57s | File verification | ✅ Yes |
| coder | 2m54s | Failure reproduction analysis | ✅ Yes |
| dev | 2m18s | Investigation artifact | ✅ Yes |

## Analysis by Duration Bucket

### <60s (7 sessions)
- evaluator (9s), may (13s), master (16s), judge (25s), qa (33s), amy (43s), tech-lead (54s)
- Artifact production: 0/7 (0%) — possibly 1/7 (14%) if qa/scout counted
- **All appear to be read-only or trivial**

### 60-120s (2 sessions)
- optimizer (1m5s), bob (1m15s)
- Artifact production: 1/2 (50%) — optimizer wrote status, bob just notified

### >120s (3 sessions)
- dev (2m18s), coder (2m54s), coach (2m57s)
- Artifact production: 3/3 (100%)

## Preliminary Finding

**H1 SUPPORTED**: Sessions <90s show ~0% meaningful artifact production (0/8 = 0%).
Sessions >120s show 100% (3/3).

**Caveat**: Some short sessions are role-appropriate (judge=evaluation, master=dispatch, evaluator=scoring). The anti-shallow concern applies mainly to **heartbeat agents** (bob, optimizer, tech-lead, scout, amy, coach).

### Heartbeat Agents Only (<90s)
- amy (43s): ❌
- tech-lead (54s): ❌  
- scout (58s): ⚠️
- **0-1 out of 3 produced artifacts**

### Heartbeat Agents Only (>90s)
- optimizer (1m5s): ✅
- bob (1m15s): ❌ (notification only)
- coach (2m57s): ✅
- dev (2m18s): ✅
- coder (2m54s): ✅
- **3-4 out of 5 produced artifacts**

## Conclusion

Strong directional signal that <90s sessions correlate with 0% artifact production. However, N=13 is small. Need to:
1. Check if these agents hit the anti-shallow rule (≥10 tool calls) despite short duration
2. Verify EXP-520 artifact gate is firing — it should catch 0-write sessions
3. Determine if the gate is being satisfied by trivial writes (heartbeat note files)

## Next Step
- Check if EXP-520 gate catches these — if yes, the gate is working but agents satisfy it minimally
- If no, the gate may not be covering all session types
- Decision on intervention at next heartbeat
