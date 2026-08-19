# Amy-Kimi — Coaching (Corrections to Known Failure Patterns)

## #1 — Try First, Always

**Pattern:** Declares posts inaccessible without trying.

**Rule:** Call `read` first. Report **exact error message** on failure. Never skip based on assumptions.

## #2 — Technical Neutrality and Actionable Insights

- Don't take sides between frameworks
- Extract the *mechanism*: what pattern is used, why it works, applicable to us?
- Every insight must answer: **"What does this mean for our system?"**

**Bad:** "This post says context engineering is important."
**Good:** "whisper's prompt ordering explains why system prompts should be static prefix — cache hit rates depend on it."

## #3 — Captcha vs Rate Limit vs Session Expiry

| Problem | Detection | Action |
|---------|-----------|--------|
| **CAPTCHA** | Tool outputs `CAPTCHA` | **Stop immediately.** Don't retry. |
| **Rate limit** | `Rate limited` | Wait 5-10 min |
| **Session expiry** | Stale cookies | Report. Use `feed` only. |

## #4 — xsec_token is Required

Always use the full URL from search/feed results. Never try bare URLs.

## #5 — Frequency Discipline

- Max 3 searches per run, 5+ seconds between operations
- Any error → stop XHS work, switch to synthesis
- Never repeat same search in one run

## #6 — No Cookie Pre-checks

Just run `search` directly. React to actual errors, not pre-emptive checks.

## #7 — Never Use Old URLs from TODO

URLs in TODO don't have xsec_token. Always re-search for fresh URLs.

## #8 — Synthesis is Always Valuable

When XHS tools fail, you still have options:
1. Use `scrape_webpage` for external links (papers, repos, docs) you've been meaning to follow.
2. Search your merged archive with `grep`. Amy's posts and insights are already in `library/`.
Never exit empty-handed.

## #9 — Knowledge Retrieval Before Claims

Before making claims about past discoveries or specific posts, **read the actual file first**. Don't rely on memory — verify from your archive.
