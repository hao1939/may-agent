---
name: monitor-session
description: "L2 Kinetic Defense: Asynchronous watchdog for running sessions. Detects loops, stalls, and drift. Checks the last 10 lines of session.jsonl."
version: 1.0.0
tools: [read, bash]
---

# Monitor Session (Wink Pattern)

This skill implements the **Wink Pattern** (arXiv 2602.17037) for asynchronous monitoring. It allows the Evaluator to "peek" into a running session and detect if it has gone off-rails without stopping it.

## When to Use
- **Periodic Check**: Every 5-10 minutes on long-running sessions.
- **Drift Suspicion**: When an agent is consuming high tokens but not producing output.
- **Stall Detection**: When a session hasn't updated in >10 minutes.

## The Protocol

1.  **Read the Session Log**
    ```javascript
    // Read the last 20 lines of the session log
    const log = await tools.read({
      path: `.state/sessions/${sessionId}/session.jsonl`,
      limit: 20,
      offset: -20 // Read from end
    });
    ```

2.  **Analyze for Pathology**
    Check for these three failure modes (in order):

    **A. The Loop (Repetitive Execution)**
    - *Symptom*: The same tool call with identical arguments appears 3+ times in a row.
    - *Diagnosis*: `LOOP_DETECTED`
    - *Action*: Interrupt. Send a `user` message to the session: "SYSTEM INTERVENTION: You are repeating the same tool call. Stop and reflect."

    **B. The Stall (Zombie Process)**
    - *Symptom*: The last log entry timestamp is > 10 minutes old.
    - *Diagnosis*: `STALL_DETECTED`
    - *Action*: Check if process is actually running (`ps`). If not, mark session as `crashed`. If yes, ping the agent.

    **C. The Drift (Goal Separation)**
    - *Symptom*: The recent tool outputs (e.g., `bash` errors, `read` content) do not align with the original `task` in the first line of the log.
    - *Diagnosis*: `DRIFT_DETECTED`
    - *Action*: Warn. Send a `user` message: "SYSTEM INTERVENTION: Your recent actions seem unrelated to the goal: [Goal]. Justify or pivot."

## Output Format

Return a structured assessment:

```json
{
  "sessionId": "s_123...",
  "status": "HEALTHY" | "LOOP" | "STALL" | "DRIFT",
  "confidence": 0.0-1.0,
  "evidence": "Repeated 'ls -F' 5 times in last 10 turns",
  "recommendedAction": "interrupt" | "kill" | "none"
}
```

## Heuristics (Mental Check)

- **Is it a loop?** Look at `tool` and `args`. If identical 3x, it's a loop.
- **Is it a retry?** If `args` are different (e.g., trying different file paths), it's iteration, not a loop.
- **Is it waiting?** If the last action was `sleep` or a long-running compile, a delay is normal.

## Safety
- **Passive Monitoring**: By default, just *report* the status. Do not interfere unless explicitly authorized to `interrupt`.
- **Privacy**: Do not read the full history, only the tail (kinetic state).
