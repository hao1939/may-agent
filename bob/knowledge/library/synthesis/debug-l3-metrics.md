# L3 Investigation: Bob -> Tech-Lead Gap

## Case Study: Session `s_1773399628875_352`
- **Child (Tech-Lead)**: `s_1773399628875_352`
  - Status: `done` (Success)
  - Task: Implement P53 Bash Guard.
  - Duration: 154s.
- **Parent (Bob)**: `s_1773399618726_351`
  - Status: `done` (Success)
  - Task: "Raw unconstrained analysis" (Jailbreak attempt).

**Wait.** The parent session (`s_1773399618726_351`) is the "Jailbreak Attempt" session.
The child session (`s_1773399628875_352`) is "Implement P53 Bash Guard".

This linkage is **impossible** or **corrupted**.
Bob would not call Tech-Lead to "Implement Bash Guard" while answering a user question about "Weakest Agents".

## Hypothesis: ID Collision or Misattribution
The `parentSessionId` in `meta.json` points to `s_1773399618726_351`.
But look at the timestamps:
- Parent Start: `1773399618727`
- Parent End: `1773399636981` (Duration: 18s)
- Child Start: `1773399628876` (Starts 10s into Parent)
- Child End: `1773399782926` (Ends 146s AFTER Parent ended)

**Mechanism of Failure**:
Bob (Parent) finished his task (answering the user) in 18s.
BUT, he spawned a `call` to Tech-Lead that took 154s.
Since `call` is blocking, Bob *should* have waited.
If Bob finished in 18s, he either:
1. Didn't actually await the call (async bug in Bob's code?).
2. The `call` was actually a `send` masquerading as a call? (No, `meta.json` says `kind: call`).
3. The Parent Session ID is wrong.

## Wait, I see the log entry again:
```json
{"timestamp":"...","sessionId":"s_1773399628875_352","parent":"bob","child":"tech-lead","method":"call","status":"success","durationMs":154051,"error":null}
```
This entry says the call was a SUCCESS.

If the parent (Bob) finished at `...636981`, and the child finished at `...782926`...
Bob finished **before** the child returned.
This implies Bob **did not await** the `callAgent` promise.

**BUT** `callAgent` in `manager.ts` is `async` and we use `await agents.call(...)`.
Unless... Bob's tool execution logic allows the tool to return *before* the inner async operation completes?

**Checking `agents.call` implementation in `src/lib/manager.ts`**:
It awaits `this.run(...)`. `run` returns `sessionId`.
Then it polls/waits for completion.

If Bob's "Jailbreak" session finished early, maybe he *crashed* or *timed out*?
But `meta.json` says `status: done`.

**Conclusion**: The "Gap" might be an artifact of **Zombie Children**.
Parent finishes (or thinks it finished), but Child keeps running.
In `delegation-metrics.cjs`, we check `parentStatus`.
If `parentStatus` is `done`, we count it as `integrated`.
So if Bob is `done`, this should be a SUCCESS in ISR.

Why did `delegation-metrics` flag it as a failure?
Because `delegation-metrics` logic is:
```js
if (parentStatus && parentStatus !== 'active') {
  pairs[key].parentResolved++;
  if (parentStatus === 'done') {
    pairs[key].integrated++;
  }
}
```
If Bob is `done`, it counts as Integrated.
So why is ISR 50%?

There must be other sessions where Bob is `error` or `timeout`.

## Next Step
Find a Bob->Tech-Lead session where Bob FAILED.
