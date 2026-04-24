# Common Sense Verification Tracker

| Rule | Last Checked | Result | Evidence |
|------|-------------|--------|----------|
| Evidence first (claims need tool output) | 2025-06-21 | ✅ PASS | 28/28 recent sessions with `status:success` included `verification_evidence`. Zero sessions claimed success without evidence. |

---

## 2025-06-22: "Context first" (cron verification)

**Item:** "Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover."

**Method:** Analyzed tool call ordering across 18 recent sessions — checked whether read/bash (context-gathering) precedes edit/write (action-taking).

**Evidence:**
- All 18 sessions showed `read` or `bash` as first tool call before any `edit`/`write`
- `s_1777023451018_1`: context at call #1, first edit at #20
- `s_1776865361854_0`: context at #1, first edit at #11
- `s_1776980935556_0`: first 6 calls were `bash` (`find . -type f`, exploring structure), then `write`
- First bash command: `"find . -type f | head -30"` — exploring before acting
- 12 of 18 sessions were read-only (no edits at all)

**Verdict:** ✅ YES — behavior is being followed consistently.


## 2025-06-22: "Simple first" (cron verification)

**Item:** "Try the simplest approach. If it works, stop."

**Method:** Searched ~130 recent sessions for complexity signals (retries, alternative approaches) vs simplicity signals. Examined tool call counts and reasoning patterns.

**Evidence:**
- Most gym sessions are lean (5-18 tool calls), suggesting agents don't over-engineer.
- **Violation with recovery** in `s_1776980935556_0`: Agent spent ~200 lines trying to engineer clean floating-point numbers, explicitly acknowledging *"I'm going in circles"* and *"I think I'm overcomplicating this"* before recovering with *"Let me just pick numbers and update the test accordingly."*
- Self-correction present but late — 3+ calculation iterations before recognizing the simpler path.
- Low retry/alternative signals across sessions (most had 0 complexity indicators).

**Verdict:** ⚠️ PARTIAL — Agents generally follow simple-first, but can fall into over-engineering traps. Self-correction exists but could be faster.

### Items Not Yet Verified
- Follow the breadcrumbs
- Ask questions when unsure
- Convention over configuration
- Metric-oriented
- Event-driven
- Own it
- One thing at a time
