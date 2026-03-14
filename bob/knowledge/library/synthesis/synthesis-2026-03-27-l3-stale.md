# L3 Investigation: Timeout Analysis

## Finding
- `manager.callAgent` is called in `createAgentsTool` (line 2355):
  ```ts
  const result = await manager.callAgent(params.agent, params.task, {
    parentSessionId: parentSid,
  });
  ```
- No `timeout` is passed to `callAgent`.
- `callAgent` (line 2127) uses `opts?.timeout`. If undefined, it uses `undefined`.
- `callAgent` calls `manager.waitFor(sessionId)` (line 2200).
- `manager.waitFor` (line 1454) uses `opts?.timeoutMs`. If undefined, it defaults to `600_000` (10 minutes).

## Diagnosis
The system default timeout is **10 minutes** (600s).
Tech-Lead P90 duration is **154s**.
This is well within the 10 minute timeout.

So why are 31% of Bob->Tech-Lead calls failing from Bob's perspective?

Possibility:
- **Proxy/Network Error**: "LLM returned stopReason toolUse but no tool call..."
  This error (seen in `s_1773395448812_214` and `s_1773395702063_220`) is a **Streaming Truncation**.
  If the LLM response is truncated, the tool call is invalid.
  Bob (the caller) receives this error.
  But Tech-Lead (the callee) might have *completed* its task?
  
  Wait. `delegations.jsonl` status is `error` for these 2 sessions.
  So TSR (Task Success Rate) counts them as FAILURES.
  
  Evaluator says: TSR 81.3% (3 failures out of 16).
  These 2 streaming errors + 1 empty response = 3 failures.
  So TSR matches the data.
  
  **The Mystery is ISR.**
  ISR = Integrated / Resolved.
  Evaluator says ISR 50.0%.
  
  This means:
  - 16 total calls.
  - 8 calls resulted in Parent SUCCESS.
  - 8 calls resulted in Parent FAILURE (or timeout).
  
  We know 3 were Tech-Lead failures.
  So 5 were **Tech-Lead Success** but **Parent Failure**.

  Why would Parent fail if Tech-Lead succeeded?
  - Parent crashed processing the result?
  - Parent hallucinated failure?
  - Parent timed out waiting (but we proved timeout is 10m).

## Hypothesis: "Consensus Hallucination"
Parent asks: "Fix X."
Tech-Lead says: "I fixed X." (Status: Success)
Parent reads result: "I fixed X."
Parent checks X: "X is still broken."
Parent marks *its own* session as Failed?

No, Bob is an agent. He doesn't "mark" session as failed unless he crashes or explicitly outputs error.
Most agents just say "I can't do it" and mark session as `done`.
If Bob marks session as `done`, ISR counts it as Success.

For ISR to be 0%, Parent must be `error`.
Or... `parentStatus` must be `null`?
If parent is `active`, it's excluded from ISR.

Wait. **Active Sessions**.
If Bob calls Tech-Lead, and Tech-Lead returns...
Bob is still running.
If Bob *never finishes*, he stays `active`.
If he stays `active`, he is **excluded** from ISR calculation.

`isr = integrated / parentResolved`

If Bob calls Tech-Lead 16 times.
3 Tech-Lead fails.
13 Tech-Lead succeeds.
Of those 13...
If 8 Bob sessions finished (Resolved).
And 5 Bob sessions are STILL ACTIVE?

If Bob is stuck in an infinite loop?
Or if Bob crashed without updating `meta.json`?

## Action
Check for **Stale Active Sessions** for Bob.
Run `ls .state/sessions/active/` and check for old Bob sessions.
