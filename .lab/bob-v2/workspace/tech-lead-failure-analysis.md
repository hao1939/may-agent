# Tech-Lead session endings: graceful vs truncated/error

This is an **infrastructure-level** failure analysis of `tech-lead` sessions in `.state/sessions/` (primarily `.state/sessions/history/`). Focus: whether sessions end cleanly vs truncation patterns Bob reported (notably `stopReason: toolUse` with **no tool blocks** and **empty response**).

## Dataset scanned
- Source: `.state/sessions/history/**/meta.json` where `.agent == "tech-lead"`
- Sessions found: **204**
  - **done:** 163
  - **error:** 32
  - **interrupted:** 9

> Note: many `meta.json` entries have `sessionId: null` (so the directory name `s_<...>` is the reliable identifier).

## Key findings
### 1) The dominant failure mode matches Bob’s report: `stopReason: toolUse` but no tool blocks
From the 32 `error` sessions:
- **19/32 (59.4%)** errors are exactly:
  > `LLM returned stopReason "toolUse" but no tool call content blocks were present. This is typically caused by a proxy or network issue that truncated the streaming response.`

This is consistent with **streaming truncation / proxy cutoffs** rather than an agent mistake.

Concrete examples (from `meta.json`):
- `.state/sessions/history/s_1773346678545_234/meta.json` (heartbeat) — stopReason toolUse/no tool blocks
- `.state/sessions/history/s_1773338931387_144/meta.json` (Ops Gate Logging task) — stopReason toolUse/no tool blocks

### 2) “Empty response” exists but is rare
- **1/32 (3.1%)** errors are:
  > `Model returned an empty response (0 output tokens). This usually indicates a model/API issue — try again or switch models.`

So the specific “Empty response” symptom is present for tech-lead, but it’s **not common** relative to the stopReason/toolUse truncation.

### 3) Prompt token limit overruns also occur (heartbeat context bloat)
- **5/32 (15.6%)** errors are 400s with:
  > `prompt token count ... exceeds the limit of 72000` (claude-opus-4.6)

Examples:
- `.state/sessions/history/s_1773334057871_87/meta.json` — 74,978 tokens
- `.state/sessions/history/s_1773357230888_342/meta.json` — 76,043 tokens

These show some tech-lead sessions fail before any work due to **context growth** (likely heartbeat instructions + accumulated state).

### 4) Additional infra/proxy parsing failures
Remainder of `error` sessions (counts over 32):
- **Unexpected end of JSON input:** 2
- **401 unauthorized (token expired):** 2
- **429 no deployments available:** 1
- **Unexpected event order:** 1
- **Cannot read properties of undefined (reading 'type'):** 1

These also look like **transport/proxy/session-layer** issues more than agent behavior.

## Overall interpretation
- Most tech-lead sessions **do finish gracefully** (`done` = 163/204, ~79.9%).
- When they fail, the predominant pattern is **exactly** Bob’s: `stopReason: toolUse` with missing tool-call blocks (19 cases).
- “Empty response” exists but appears to be a **minor** slice (1 case) compared to the truncation pattern.
- A secondary systemic issue is **prompt token limit overflow** (5 cases), especially on heartbeat-style tasks.

## What to check next (if you want deeper attribution)
If needed, the next step would be to sample the corresponding `session.jsonl` files for a few of the failing directories above to confirm whether the stream ends right after `stopReason: toolUse` and whether any partial tool blocks appear before cutoff.
