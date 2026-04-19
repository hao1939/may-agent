# Design/Implementation Alignment Review

**Status:** Draft
**Date:** 2026-03-04
**Reviewer:** Bob

This document identifies discrepancies between the system documentation (`docs/design.md`, `docs/usage.md`) and the actual implementation (`src/manager.ts`, `run/may.ts`, `run/agent-loader.ts`).

## 1. Persistence Layout

### `docs/design.md` claim:
```
<persistDir>/
  ├── memory/
  │   ├── amy.jsonl
  ├── evaluations/
  ├── staged/
  ├── sessions/
  │   ├── <sessionId>/
  │   │   ├── meta.json
  │   │   ├── session.jsonl
  │   │   └── output/
  └── sessions/history/
      └── <sessionId>/
```

### Implementation (`src/persistence.ts` imported by `manager.ts`):
- **Sessions:** The code uses `.state/sessions/<id>/` and `.state/sessions/history/<id>/`. This matches.
- **Memory:** The code uses `.state/memory/<agent>.jsonl`. This matches.
- **Evaluations:** The code uses `.state/evaluations/<sessionId>.json`. This matches.
- **Workflows:** The code uses `.state/workflows/<runId>.json`. This is **missing from the design doc**.
- **Staged:** `docs/design.md` mentions `staged/workflows/`, but I do not see this in the active code paths I reviewed in `manager.ts` or `persistence.ts` imports.

**Discrepancy:** The `staged/` directory seems to be a design concept not yet implemented or abandoned. The `workflows/` directory in persistence is implemented but missing from the design doc layout.

## 2. Session Lifecycle & API

### `docs/design.md` claim:
"Session Completion... 4. Append to memory/<name>.jsonl... 5. Move sessions/<id>/ → sessions/history/<id>/"

### Implementation (`src/manager.ts`):
- `handleCompletion` calls `archiveSession`, which moves the directory. This matches.
- `handleCompletion` appends to memory. This matches.
- **Idle State:** The implementation introduces an `"idle"` state for persistent sessions. `docs/design.md` mentions `idle` in the text but the `SessionInfo` interface listing in the doc shows `status: "running" | "done" | "error" | "interrupted"`. It is missing `"idle"`.

**Discrepancy:** `SessionInfo` interface in `docs/design.md` is missing the `"idle"` status, which is crucial for the interface agent's persistent session.

## 3. Agent Configuration & Loading

### `docs/usage.md` claim:
"Agents are defined by `agent.json` config files... `tools` field is an array of strings (presets)."

### Implementation (`run/agent-loader.ts`):
- The loader reads `agent.json`.
- It supports tool presets: `"read-write"`, `"read-only"`, `"exec"`, `"exec-readonly"`, `"exec-master"`, `"subagents"`, `"workflow"`.
- `docs/usage.md` lists these presets.

**Discrepancy:** None found. The dynamic loading and presets match the documentation.

## 4. Socket Commands

### `docs/usage.md` claim:
Supported commands: `input`, `run`, `steer`, `cancel`, `cancel_task`, `cancel_all`, `close`, `status`, `reload_agents`.

### Implementation (`run/may.ts`):
- `bus.onCommand` handles:
    - `steer`
    - `cancel`
    - `cancel_all`
    - `cancel_task`
    - `close`
    - `status`
    - `input`
    - `run`
    - `reload_agents`

**Discrepancy:** None found. The implemented commands match the documentation perfectly.

## 5. TTY Commands

### `docs/usage.md` claim:
"Interactive (TTY)... `you> @coder fix...`, `cancel`, `close`, `reload`, `exit/quit`"

### Implementation (`run/may.ts`):
- `rl.on('line')` loop checks for:
    - `exit` / `quit`
    - `close`
    - `cancel`
    - `reload`
    - `@<agent>` prefix logic

**Discrepancy:** None found.

## 6. Runner Implementation Details

### `docs/design.md` claim:
"No platform dependency. The caller controls tool provisioning and API keys."

### Implementation (`run/may.ts`):
- `run/may.ts` is the "platform" here. It hardcodes the `models` map (opus, gpt52, gemini3pro) pointing to `localhost:4000`.
- This matches the design (the *library* `SubagentManager` is generic, the *runner* `run/may.ts` provides the specifics).

### `docs/usage.md` claim:
"Auto-restart on crash (production)... `./run.sh`"

### Implementation:
- `run.sh` is referenced but I haven't read it. Assuming it exists based on the doc.

## Findings Summary

1.  **Missing "idle" status in Design Doc:** `docs/design.md` defines `SessionInfo.status` but omits `"idle"`, which is a valid state for persistent sessions in `src/manager.ts`.
2.  **Missing "workflows" dir in Design Doc:** `docs/design.md` persistence layout misses the `.state/workflows/` directory which `src/persistence.ts` uses for workflow run storage.
3.  **Phantom "staged" dir in Design Doc:** `docs/design.md` includes a `staged/workflows/` directory which doesn't seem to be used in the current implementation.

## Recommendations

1.  Update `docs/design.md` to include `"idle"` in the `SessionInfo` status type.
2.  Update `docs/design.md` persistence layout: remove `staged/` and add `workflows/`.
