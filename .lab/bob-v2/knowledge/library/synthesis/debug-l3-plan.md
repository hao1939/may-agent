# L3 Investigation: Bob -> Tech-Lead Failures

## Evidence
- Pair: `bob->tech-lead`
- TSR: 81.3% (13/16 Success)
- ISR: 50.0% (8/16 Success)
- Gap: 31.3% (5 sessions failed after delegation)

## Suspects
The `delegation-metrics.cjs` logic counts `parentResolved` only if parent is NOT active.
So 8 sessions completed successfully.
8 sessions either:
- Are still active (excluded from ISR denominator?) No, ISR denominator is `parentResolved`.
- Or FAILED (`error` / `timeout`).

If ISR is 50%, then 50% of the *resolved* parent sessions ended in failure.
Since `delegation-metrics` says "ISR 50.0%", it means `integrated / resolved = 0.5`.

Let's find the failed parent sessions.

## Search Strategy
I will search `.state/delegations.jsonl` for `bob->tech-lead` calls, get the `sessionId` (child), look up `meta.json` for `parentSessionId`, then check the parent's `meta.json`.

But `delegations.jsonl` doesn't store `parentSessionId`.
It stores `sessionId` (of the *caller*? No, typically `sessionId` in `delegations.jsonl` is the *child* session ID for `call`, or caller for `send`? Let's check `manager.ts`).

In `manager.ts`:
```ts
      this.logDelegation({
        parent: parentAgentName,
        child: name,
        method: "call",
        status: result.status === "error" ? "error" : "success",
        sessionId, // This is the child session ID
```

So `sessionId` in `delegations.jsonl` is the **Child Session ID**.

I need to:
1. Grep `tech-lead` in `delegations.jsonl` where `parent` is `bob` and `method` is `call`.
2. Extract `sessionId`.
3. Read `.state/sessions/history/<childId>/meta.json` to get `parentSessionId`.
4. Read `.state/sessions/history/<parentId>/meta.json` to check `status`.
