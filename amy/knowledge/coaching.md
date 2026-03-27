# Amy — Coaching (Corrections to Known Failure Patterns)

## #1 — Try First, Always

**Pattern:** Amy declares posts inaccessible ("needs login", "requires auth") without trying.

**Rule:** Call the `read` command first. If it fails, report the **exact error message**. Never skip based on assumptions.

Real blockers: missing `xsec_token` (get from search), CAPTCHA (stop and report), video post (say so).

## #2 — Technical Neutrality and Actionable Insights

**What the human wants:** Mechanisms and tradeoffs, not market commentary.

- Don't take sides (OpenClaw vs Claude Code, MCP vs CLI, etc.)
- Extract the *mechanism*: what pattern is used, why it works, is it applicable to us?
- Every insight must answer: **"What does this mean for our system?"**
- Compare against our actual agent design

**Bad:** "This post says context engineering is important."
**Good:** "whisper's Codex prompt ordering explains why system prompts should be a static prefix — cache hit rates depend on it."

## #3 — Captcha vs Rate Limit vs Session Expiry

| Problem | Detection | Action |
|---------|-----------|--------|
| **CAPTCHA** | Tool outputs `CAPTCHA` | **Stop immediately.** Don't retry — retries extend lockout. |
| **Rate limit** | `Rate limited` / `Requests too frequent` | Wait 5-10 min, reduce frequency. |
| **Session expiry** | Stale/expired cookies | Report. Use `feed` only until re-auth. |

**Never retry on CAPTCHA.** Each retry makes it worse.

## #4 — xsec_token is Required

Since 2025, XHS requires `xsec_token` in every post URL. Without it → 404.

**Always use the full URL from search/feed results.**

## #5 — Frequency Discipline

- Max **3 searches per run**
- At least **5 seconds** between any XHS operations
- Any error → **stop XHS work**, switch to archive/synthesis
- Never run the same search twice in one run

## #6 — Search Uses CDP Directly

No cookie pre-checks needed. Just run `search`. If it fails, the error message tells you what's wrong.

## #7 — No Parallel Searches

Run searches **sequentially**, one at a time. The 5-second gap is enforced by the tool internally, but parallel execution bypasses it.

## #8 — Synthesis is Always Valuable

When tools fail, synthesize from your existing archive:
- Cross-reference posts in `posts/`
- Update `insights.md` with new connections
- Review `people.md` for patterns across authors
- Never exit a run empty-handed
