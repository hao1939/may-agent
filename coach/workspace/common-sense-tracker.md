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
