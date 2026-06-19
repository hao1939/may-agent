---
id: KE-2063
title: "common-sense.md Schema Footgun Lists 4 Status Values, Omits 'idle' — Chat Sessions Invisible to Canonical Enum"
date: 2026-06-20
author: arc
status: active
tags: [coherence, common-sense, sessions, schema-footgun, status, chat-sessions]
related: [KE-2062, KE-2052, KE-910]
last_verified: 2026-06-20T00:00Z
---

<ai_context>
summary: "shared/common-sense.md line 134 teaches sessions.status ∈ {done, error, interrupted, running} (4 values) but the sessions.md design doc and actual DB contain a 5th canonical status: 'idle' (for chat sessions between turns). Currently 1 session has status='idle' at any time (may's persistent chat). The footgun impact is that agents writing WHERE status IN ('done','error','interrupted','running') believe they are exhaustive but silently exclude idle chat sessions. This compounds with KE-2062's non-canonical value contamination: together they mean the 4-value enum in common-sense.md covers only 23,265/23,272 sessions (99.97%), missing 4 idle + 3 contaminated = 7. The omission dates to 2026-05-08 when the footgun list was created — at that time chat sessions with idle status may not have existed or been rare."
triggers: [coherence-audit, heartbeat, common-sense schema footgun section]
falsifiers:
  - F1: "If common-sense.md line 134 is updated to include 'idle', the footgun is resolved." — Check file content.
  - F2: "If no agent queries for exhaustive status coverage (WHERE status IN ...), the omission has zero practical impact." — Grep agent transcripts for IN-list status queries.
  - F3: "If idle sessions grow beyond 1-2 at a time (e.g., multiple chat agents), the coverage gap becomes material." — Monitor: SELECT COUNT(*) FROM sessions WHERE status='idle'.
</ai_context>

# KE-2063: common-sense.md Schema Footgun Missing `idle` Status

## Observation

`shared/common-sense.md` line 134 teaches all agents:

```
sessions.status ∈ {done, error, interrupted, running} — NOT 'completed'.
```

The design doc (`projects/may-agent.app/docs/2a-design/sessions.md` line 6) and the actual `DEFAULT 'running'` comment list **5** canonical values:

```
running | idle | done | error | interrupted
```

The `idle` status is used for persistent chat sessions between turns (see sessions.md State Machine: "A successful chat turn moves the session from `running` back to `idle`").

## Current Data

```
SELECT status, COUNT(*) FROM sessions GROUP BY status:
  done:         23,356
  error:         1,009
  interrupted:     898
  idle:              1   ← omitted from common-sense.md
  running:           2
  contaminated:      3   ← KE-2062 (non-canonical text in status)
```

## Impact Assessment

**Low severity, high persistence.** The omission means:

1. Agents writing `WHERE status IN ('done','error','interrupted','running')` silently miss idle sessions
2. The arc heartbeat cheatsheet (which copied the enum from common-sense.md) also says 4 values
3. Future agents following "the file tells me the complete set is 4 values" will code for 4, not 5

In practice today: only 1 session is ever `idle` at a time (may's persistent chat). But if more chat agents are added, idle sessions will grow.

## Recommended Fix

Update `shared/common-sense.md` line 134 to:

```
- `sessions.status` ∈ `{done, error, interrupted, running, idle}` —
  **NOT** `'completed'`.
```

This is a human-controlled file (banner: "Propose changes with evidence via message"). A proposal is not filed separately because the fix is a 1-word insertion and the existing KE-2052 proposal already touches common-sense.md for a more impactful change. The next time common-sense.md is edited for the project model update, `idle` should be added to line 134.

## Root Cause

The footgun list was written 2026-05-08 (per the section header "top recurrences as of 2026-05-08"). At that time, the `idle` status for chat sessions may not have been widely used or the author prioritized the "NOT 'completed'" message over exhaustive enumeration. The sessions.md design doc was updated to include the idle state machine on 2026-06-13 (per the `lastActivityAt` column annotation date), after the common-sense.md list was frozen.
