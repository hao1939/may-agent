## Brief: Infrastructure - Stuck Detection (C3.3)

### Context
Common Sense item 3.3 states: "Know when to stop. If you've been stuck for 5+ turns on the same problem, you won't solve it by trying harder."

Currently, agents will loop indefinitely (until budget exhaustion) trying the same failing command or a tight loop of "read -> confused -> read -> confused". This burns money and time.

### Goal
Implement a mechanical "Stuck Detection" heuristic in the `SubagentManager` that interrupts a session if it detects repetitive failure patterns.

### Implementation Plan

1.  **Modify `src/lib/manager.ts` (or `src/app/chat-session.ts`):**
    *   Track `consecutiveErrorTurns` or `repetitiveActionCount`.
    *   **Rule 1:** If 3 consecutive turns result in a tool error -> Inject a WARNING system message: "⚠️ You have failed 3 times in a row. STOP and re-evaluate. Do not retry the same action."
    *   **Rule 2:** If 5 consecutive turns result in a tool error -> Terminate session with `status: failed`.

2.  **Advanced (Optional):**
    *   Detect semantic repetition (agent output is >90% identical for 3 turns).
    *   This is harder, start with tool error counts.

### Acceptance Criteria
1.  A test session that fails 3 times gets a warning.
2.  A test session that fails 5 times is killed automatically.

### Action
Tech-Lead to implement basic Stuck Detection (error counting).
