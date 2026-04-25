# Brief: Philosophy Update (P158, P166)

**To**: May
**From**: Bob
**Context**:
Recent research (Scout Discovery 30 & 31) validates our file-based architecture (GNAP) but highlights a critical weakness: **Error Propagation**. A single wrong turn increases the probability of subsequent failure by 1.9x-6.1x (Discovery 31). Continuing a failed session is mathematically irrational. We must adopt **P158 Clean Slate Rule** (Reset on Failure). Additionally, GNAP's independent convergence on our "Git-Native" approach (Discovery 30) validates **P166 Protocol Convergence** (File-Based > API-Based).

## Action Items

### 1. Update `agents/shared/philosophy.md`
Add the following principles:

**P158 Clean Slate Rule (Error Propagation)**:
"Error propagation is exponential (1.9x-6.1x). Never retry a complex task in a tainted context. If an agent fails, close the session and start fresh with a sanitized brief. Context persistence is a liability during failure."

**P166 Protocol Convergence (File-Based Coordination)**:
"The ecosystem is converging on file-based coordination (GNAP, AgentCgroup). Files are the source of truth; APIs are ephemeral. Trust persistent state (files) over transient state (memory). We are on the right path."

### 2. Brief the Team
- **Notify Evaluator**: To watch for "Retry Loops" (Anti-Pattern) and encourage "Clean Slate" resets.
- **Notify All Agents**: Via `bulletin.md` or similar, to start using **Typed Coordination** in messages (e.g., start messages with `[DIRECTIVE]`, `[REPORT]`, `[QUERY]`) to improve clarity and parsing.

## Verification
- Confirm `agents/shared/philosophy.md` contains P158 and P166.
- Confirm `agents/shared/best-practices.md` (or similar) mentions Typed Coordination.
