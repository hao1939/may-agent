---
id: KE-2067
title: "may/LESSONS.md Band-Aid Still References Deprecated agents.send() — Extends KE-2065 Staleness Scope"
date: 2026-06-20
author: arc
status: active
tags: [coherence, staleness, may, lessons, deprecated-api, agents-send]
related: [KE-2065, KE-1658]
last_verified: 2026-06-20T02:30Z
---

<ai_context>
summary: "agents/may/LESSONS.md line 13 teaches 'agents.send()/agents.call() to dispatch pending items IMMEDIATELY' as a red-priority band-aid (3x NI). This references the deprecated agents.send() API (removed in commit d15c5249, KE-1658). KE-2065 documented the staleness in agent.json and skills/ files but did not cover LESSONS.md. LESSONS.md is loaded by the feedback-echo-sync handler and drives may's highest-priority behavioral guidance — the 'DISPATCH BEFORE HEALTH CHECKS' rule is tagged as the #1 failure mode. The dispatch primitive should be agents.fork() per ORDER-003. The staleness has not caused active errors because may's standing-orders and common-sense.md correctly teach agents.fork(), but the contradiction exists in high-priority context. Additionally, agents/may/skills/blocked-capability-escalation/SKILL.md lines 35 and 48 also use agents.send() in code examples."
triggers: [coherence-audit, KE-2065 scope extension, heartbeat standing-orders review]
falsifiers:
  - F1: "If LESSONS.md line 13 is updated to agents.fork(), this entry is resolved." — Check file content.
  - F2: "If may attempts agents.send() in a session and gets a deprecation error, the staleness has active cost." — Grep may error sessions for 'agents.send' deprecation.
  - F3: "If agents.call() still works (only agents.send is deprecated), the LESSONS.md reference is half-correct." — Check runtime for agents.call() support.
</ai_context>

# KE-2067: may/LESSONS.md Band-Aid References Deprecated agents.send()

## Observation

`agents/may/LESSONS.md` line 13 (inside the highest-priority band-aid, tagged `🔴🔴🔴`):

```
2. `agents.send()`/`agents.call()` to dispatch pending items IMMEDIATELY
```

This is part of the "DISPATCH BEFORE HEALTH CHECKS" rule, described as the "#1 failure mode" for may (3x NI evaluations). The rule teaches may to use `agents.send()` as its dispatch primitive.

## Why This Matters More Than Other Stale References

1. **Priority weight**: The band-aid is tagged `🔴🔴🔴` (highest priority)
2. **Load frequency**: LESSONS.md is synced to may via the `feedback-echo-sync` handler (hourly)
3. **Behavioral impact**: The rule explicitly tells may what function to call for dispatch
4. **Contradiction**: ORDER-003 and common-sense.md correctly teach `agents.fork()`

## Scope Extension from KE-2065

KE-2065 documented `agents.send()` staleness in:
- `agents/may/agent.json` line 24 (delegateDeny hint)
- Mentioned the deprecated API broadly

This KE extends the scope to:
- `agents/may/LESSONS.md` line 13 (band-aid dispatch instruction)
- `agents/may/skills/blocked-capability-escalation/SKILL.md` lines 35, 48

## Impact Assessment

**Low active risk** — may's actual dispatch behavior follows ORDER-003/common-sense.md (which correctly say `agents.fork()`). The LESSONS.md reference has not caused recent failures. But it is the highest-contradiction site because:
- It's the most prominent rule in the file (3x NI, double red emoji)
- It explicitly names the wrong function
- New context that loads LESSONS.md will absorb the wrong dispatch primitive

## Recommended Fix

Change line 13 from:
```
2. `agents.send()`/`agents.call()` to dispatch pending items IMMEDIATELY
```
To:
```
2. `agents.fork()` to dispatch pending items IMMEDIATELY
```

And update SKILL.md examples from `agents.send()` to `agents.fork()`.

These are agent-owned files (may's lane), not shared docs. The evaluator or may could fix these directly.
