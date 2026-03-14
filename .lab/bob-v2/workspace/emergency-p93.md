# EMERGENCY INTERVENTION: P93 Retry Patch (Bob)

**Context**: 
The system is in a "Crash Loop" where the optimizer cannot fix the crash bug because it crashes while trying to fix it.
- s_1773410754337_702: Crashed (empty toolUse).
- s_1773410985679_706: Crashed (empty toolUse).

**Diagnosis**:
The `manager.ts` code receives `stopReason: "toolUse"` from the model but `content` has no tool blocks. This is an LLM provider/proxy issue. The current code throws an error immediately. We need to catch this specific pattern and retry.

**Plan**:
1.  Read `src/lib/manager.ts`.
2.  Identify the exact point where `agent.generate()` is called.
3.  Wrap it in a `retryLoop` function.
4.  Implement the retry logic directly using `edit()`.

**Safety**:
I am authorized to edit code when the system is unstable and delegation fails (P1 System over Agent). This is a P0 stability fix.
