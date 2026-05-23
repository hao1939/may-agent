# Empty tool-use assistant turn recorded as done

## Trigger

Evaluator sent a P1 review request for session `s_1779504377088_1209`: the transcript ended with an empty assistant message whose `stopReason` was `toolUse`, but the runtime recorded the session as `status='done'` / `outcome='done'`.

## Evidence

- Transcript `.state/sessions/history/s_1779504377088_1209/session.jsonl` has 5 lines. Line 5 is an assistant message with `content:[{type:"text",text:""}]` and `stopReason:"toolUse"`.
- DB row for `s_1779504377088_1209` records `agent='may'`, `status='done'`, `outcome='done'`, `error=NULL`, `opCount=2`.
- The paired `session.end` event summarized only the initial plan, so downstream handlers treated the run as complete; `session-recovery` skipped it because `session.completed` was not recoverable for `status='done'` / `outcome='done'`.

## Root cause

The session finalizer in `projects/platform/repos/may-agent/src/lib/manager.ts` only classified a run as error when there was no finish call and no extractable assistant text. `extractLastAssistantText()` scans backward across the whole transcript, so a previous planning message counted as a successful response even when the final assistant turn was an empty or unresolved `toolUse` turn.

## Fix

Patched the platform runtime copy under `projects/platform/repos/may-agent`:

- Added `classifyTerminalAssistantFailure()` in `src/lib/manager-utils.ts`.
- Called it from `src/lib/manager.ts` before status selection when there is no `finish()` call.
- Added regression coverage in `test/integration/session-lifecycle-fixes.test.ts` for:
  - empty `stopReason:'toolUse'` assistant turn,
  - pending tool call with no tool result,
  - substantive final assistant text.

This prevents an unfinished final assistant turn from being counted as a successful completion merely because earlier assistant text exists.

## Validation

Run from `projects/platform/repos/may-agent`:

```bash
bun test test/integration/session-lifecycle-fixes.test.ts
```
