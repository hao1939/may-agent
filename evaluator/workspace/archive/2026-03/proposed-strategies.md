# Proposed Strategies (P63) — Extracted from recent session logs

Run: 2026-03-13 (last 24h sample)  
Scope: last 50 session logs in `.state/sessions/history/**/session.jsonl` (mtime within 24h)  
Extraction method: `agents/evaluator/skills/extract-strategy.cjs` (regex-based TOOL_ERROR trigger scan)

## High-confidence recovery tips

### 1) Treat tool schema failures as a prompt/interface mismatch, not a “runtime bug”
**Trigger pattern:** `Validation failed for tool "read"` / `Validation failed for tool "bash"` (also seen for `scrape_webpage`)  
**Why it matters:** These are usually caused by incorrect parameter names/types (e.g., using `startLine/endLine` instead of `offset/limit`, wrong JSON shape, missing required fields). They waste turns and can cascade into further confusion.

**Recovery tip:** When you see a tool validation error, immediately:
- Re-open the tool’s schema/usage (or consult the agent’s tool list) and re-issue the call with the exact required keys.
- Prefer “copy/paste known-good invocation” patterns for frequently used tools.

**Suggested standard correction:** “Re-issue the same tool call with the documented parameter keys (for `read`: `path`, optional `offset`, `limit`).”

---

### 2) ENOENT on evaluator workspace files is expected; treat as ‘no data’, not as an exception to fight
**Trigger pattern:** `ENOENT: no such file or directory, access '/app/agents/evaluator/workspace/consistency-flags.jsonl'` (also `human-reviews.jsonl`, `re-evaluations.jsonl`, `notifications.jsonl`)  
**Why it matters:** Many heartbeat/calibration files are optional and may legitimately not exist yet. Repeatedly attempting reads without guarding can create noisy error logs.

**Recovery tip:** Implement/encode the convention:
- If a workspace optional file read returns ENOENT, treat it as “empty” and continue.
- Only escalate if a *required* file is missing.

---

### 3) Hard-coded or non-existent working directories cause pointless bash failures
**Trigger pattern:** `/bin/bash: line 1: cd: /home/claude/vibetool: No such file or directory` (also `/home/opus`)  
**Why it matters:** This indicates the agent assumed a home directory that doesn’t exist in this runtime. The project root is `/app`; relative paths should be from there.

**Recovery tip:**
- Avoid `cd` to hard-coded home paths.
- Use relative paths from repo root, or explicitly `cd /app` if needed.

---

### 4) “(no output)” tool errors should trigger immediate: check command exit, stderr, and timeouts
**Trigger pattern:** `(no output)`  
**Why it matters:** A blank tool result often means the command produced nothing, failed silently, or output was truncated/redirected. Agents can mistakenly treat it as success.

**Recovery tip:**
- Re-run with `set -x` or add `; echo $?` to capture exit status.
- Ensure timeouts are sufficient for long-running commands.

## Notes / limitations
- Current extractor is conservative and only picks up `[TOOL_ERROR]`-style signals; it does not yet correlate “failure → later success” within the same session.
- Some triggers (e.g., `Tool scrape_webpage not found`) may reflect role-specific tool availability rather than a general recovery pattern.

**Status**: Processed by Bob (2026-03-13). Content moved to `agents/shared/knowledge/strategies.md`.
