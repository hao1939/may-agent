# Evaluator aftermath routing drift — code-path root cause brief

## Executive finding

The visible `handler.skipped` rows on stale receipted sessions are a red herring. They are `session-recovery`'s expected non-recoverable skip, not the evaluator suppression point.

The actual failure is upstream of evaluator review but **inside the evaluator-aftermath event bridge / trigger parser path**:

1. `agents/may/cron.json` wires `evaluator-aftermath` as a workflow-backed handler on `session.completed` with `includeEvent: true`.
2. `@may-agent/sdk` appends the full event envelope into the workflow task as a fenced markdown block (`## Trigger Event` + ```json ... ```).
3. `agents/evaluator/workflows/evaluator-aftermath.ts` re-parses that markdown with a brittle regex that assumes the JSON block contains no inner triple-backtick fences.
4. For source sessions whose original `task` text already contains markdown code fences (common in heartbeats and owner-loop prompts), the embedded `event.data.task` string contains literal ``` markers. The regex stops at the first inner fence, JSON parse fails, `extractTrigger()` returns `null`, and the workflow escalates via `evaluator-aftermath requires a sessionId` instead of emitting `context.read` / `evaluation.routed`.

So the drift is **not** "session-recovery skipped evaluator". It is **"event bridge delivered a markdown-wrapped trigger whose consumer parser breaks when the source task contains fenced code blocks"**.

## Exact code references

### 1) Event bridge is enabled for evaluator aftermath
`agents/may/cron.json`:

```json
{
  "name": "evaluator-aftermath",
  "handler": {
    "workflow": "evaluator-aftermath",
    "agent": "evaluator",
    "task": "Evaluate the completed session, produce metrics/evaluation signal, fix obvious low-risk root causes, escalate when blocked, and capture reusable learning.",
    "includeEvent": true
  },
  "on": ["session.completed"]
}
```

### 2) Generic workflow bridge wraps the trigger in fenced markdown
`projects/platform/repos/may-agent/packages/sdk/src/index.ts`:

```ts
function appendEvent(task: string, event: EventEnvelope | undefined): string {
  if (!event) return task;
  return `${task}\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}
```

This is the active workflow-backed handler implementation reached via the SDK package boundary.

### 3) Evaluator aftermath re-parses the trigger with a brittle fence regex
`agents/evaluator/workflows/evaluator-aftermath.ts`:

```ts
function extractTrigger(task: string): any {
  const match = task.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
```

Later in the same file:

```ts
const trigger = extractTrigger(String(ctx.task ?? ""));
const sessionId = getSessionIdFromTrigger(trigger);
...
if (!sessionId) {
  return ctx.escalate("evaluator-aftermath requires a sessionId", { trigger });
}
```

### 4) A second workflow already uses the same brittle trigger regex
`agents/may/workflows/metric-alert-triage.ts` also matches `## Trigger Event ... ```json ... ```` with the same pattern, so this is likely a reusable parser bug rather than evaluator-only design.

## Canonical reproducer package

## Repro class A — source task contains fenced code blocks, immediate evaluator path misses

These sessions all have:
- `status='done'`
- canonical `session.receipt`
- lifecycle stopping at `... session.completed | session.receipt | handler.skipped`
- no evaluator `context.read`
- no `evaluation.routed`
- no `evaluations` row at the time of audit
- source `task` text containing literal triple-backtick fences

Examples from canonical DB checks:

| sessionId | agent | task_len | contains ``` in source task? | outcome at audit |
|---|---|---:|---:|---|
| `s_1780321438750_0` | dev | 11231 | yes | stale miss |
| `s_1780321438856_3` | may | 8321 | yes | stale miss |
| `s_1780325171886_49` | arc | large heartbeat | yes | stale miss |
| `s_1780325171848_48` | dev | large heartbeat | yes | stale miss |
| `s_1780325171921_50` | may | large heartbeat | yes | stale miss |

Concrete stale lifecycle example:
- `s_1780321438750_0`: `session.start | guard.triggered | session.end | session.completed | session.receipt | handler.skipped`
- `handler.skipped` data: `handler='session-recovery'`, `reason='session.completed is not recoverable'`
- no evaluator `context.read`, no `evaluation.routed`, no `evaluations` row

Concrete stale lifecycle example:
- `s_1780321438856_3`: same stop point; `handler.skipped` again belongs to `session-recovery`

## Repro class B — source task has no fenced code blocks, immediate evaluator path works

These sessions had the same `session.completed` trigger model, but their source `task` text did **not** contain triple-backtick fences, and the immediate evaluator path succeeded.

| sessionId | agent | task_len | contains ``` in source task? | immediate evaluator result |
|---|---|---:|---:|---|
| `s_1780321438777_1` | scout | 45 | no | worked immediately |
| `s_1780321493741_8` | aks-explorer | 7481 | no | worked immediately |
| `s_1780322736494_3` | aks-explorer | 7524 | no | worked immediately |
| `s_1780323080555_2` | aks-explorer owner-loop | 1415 | no | worked immediately |
| `s_1780313191714_310` | older aks-explorer | 6986 | no fences | should have worked; remained stale due to not yet being backfilled during the earlier audit window |

Concrete handled control:
- `s_1780321493741_8`
  - `session.receipt` at `1780321908798`
  - evaluator `context.read` at `1780321908893`
  - `evaluation.routed` at `1780321908912`

Concrete handled control:
- `s_1780323080555_2`
  - `session.receipt` at `1780323200896`
  - evaluator `context.read` at `1780323201612`
  - `evaluation.routed` at `1780323201627`

## Why the visible `handler.skipped` row is misleading

The stale sessions visibly end with `handler.skipped`, but the row is always:
- `source='agent:may'`
- `handler='session-recovery'`
- `reason='session.completed is not recoverable'`

That is emitted by `agents/may/handlers/session-recovery.ts`:

```ts
if (event.type === "session.completed" && status !== "error" && status !== "interrupted" && outcome !== "error" && outcome !== "interrupted") {
  emitSkip(ctx, sessionId || null, "session.completed is not recoverable", { eventType: event.type, status, outcome });
  return;
}
```

So the row merely says "do not attempt recovery for a successful session." It does **not** say anything about evaluator aftermath success/failure.

## Why the fence-poisoning hypothesis fits the data best

1. **Immediate success/failure correlates with source task shape, not with receipt presence or session-recovery behavior.**
   - Successful immediate aftermath controls (`s_1780321493741_8`, `s_1780323080555_2`, `s_1780321438777_1`) have source tasks without triple-backtick fences.
   - Immediate misses (`s_1780321438750_0`, `s_1780321438856_3`, recent arc/dev/may misses) have source tasks that include markdown code fences.

2. **The bridge serializes the entire `session.completed` event, including `event.data.task`.**
   Canonical `session.completed` rows clearly store the full original task text in `data.task`.

3. **The consumer parser is regex-based markdown scraping, not structured event transport.**
   `extractTrigger()` stops at the first closing ``` after `## Trigger Event`, so any inner fence in serialized JSON can terminate the capture early.

4. **The symptom matches the consumer failure mode exactly.**
   When `extractTrigger()` returns `null`, `getSessionIdFromTrigger()` returns `undefined`, and evaluator aftermath escalates with `evaluator-aftermath requires a sessionId` before emitting `context.read` / `evaluation.routed`.

5. **The fallback safety net later repairs some of these misses.**
   `agents/may/handlers/session-aftermath-scan.ts` synthesizes a minimal trigger whose `data` only includes `mode`, `sessionId`, `agent`, and `status`; it does not embed the huge original task text, so the same parser succeeds later. That explains why several initially stale sessions eventually gain `context.read` / `evaluation.routed` after the 7-minute scan, while others remain visible drift until scanned.

## Smallest plausible fix surface

### Smallest targeted fix
Harden `agents/evaluator/workflows/evaluator-aftermath.ts` trigger extraction so it does **not** depend on fenced-markdown parsing.

Practical options, in increasing scope:

1. **Evaluator-only parser hardening**
   - Replace the regex fence parser with logic that finds the last `## Trigger Event` marker and parses the JSON object robustly without being confused by inner ``` inside string values.
   - Lowest blast radius; directly addresses the live drift.

2. **Shared trigger-extraction helper for workflows that consume bridged events**
   - Move robust parsing into a shared helper and update `evaluator-aftermath` plus `metric-alert-triage`.
   - Slightly broader but fixes the same class anywhere it already exists.

3. **Bridge-format fix**
   - Change `appendEvent()` to encode the trigger in a format that cannot be terminated by source-task markdown fences (for example longer fences plus matching parser support, or a non-fenced sentinel serialization).
   - Best long-term transport design, but broader compatibility surface.

## Recommended owner action

**Owner:** May / runtime owner

**Recommended first implementation:**
- Patch `evaluator-aftermath` to use a robust trigger parser that survives embedded markdown fences in `event.data.task`.
- Add a regression test using a `session.completed` trigger whose `data.task` contains literal triple-backtick code blocks.
- Then optionally generalize the parser/helper for other workflows using the same pattern.

## Minimal regression tests to require

1. `evaluator-aftermath` can extract `event.data.sessionId` when the serialized trigger contains a source `task` with:
   - plain triple backticks
   - ```sql
   - ```bash
2. A control case with no inner code fences still passes.
3. `metric-alert-triage` (or any other workflow using the same regex) is checked for the same parser weakness.

## Escalation path if May wants the narrowest safe change

If May does not want to touch the generic SDK bridge immediately, the safe escalation is:
- treat this as an **evaluator workflow parsing bug**, not a session-recovery or evaluator liveness bug,
- land the parser hardening in `agents/evaluator/workflows/evaluator-aftermath.ts`,
- validate by re-running the receipt/routing audit until fresh receipted heartbeat-style sessions no longer accumulate in the stale miss bucket.

## Bottom line

The routing drift comes from **markdown-fence poisoning of the bridged `## Trigger Event` block**. Sessions whose original `task` contains code fences serialize those fences inside `event.data.task`; `evaluator-aftermath` then re-parses that markdown with a non-robust regex, loses the trigger, and escalates before emitting aftermath markers. The visible `session-recovery` `handler.skipped` row is incidental noise, not the suppression gate.