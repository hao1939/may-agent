# QA C1.4/C8.2 Finish() Investigation — April 2026

**Date**: 2026-04-13
**Status**: Root cause identified, fix proposed
**Impact**: QA fails C1.4 in ~14% of sessions (35 of 252 in last 7 days)

## Root Cause

**SOUL.md's Output Format section competes with heartbeat's finish() instruction.**

The Output Format in `agents/qa/SOUL.md` says:
```
### Summary — One paragraph: what changed, does it work, overall assessment.
### Checks — tsc --noEmit: PASS/FAIL, vitest --run: PASS/FAIL (N tests)
### Issues — Each with severity (CRITICAL/IMPORTANT/MINOR).
### Verdict — PASS / FAIL / CONDITIONAL
```

This describes a **text-based report format**. QA dutifully writes Summary → Checks → Issues → Verdict as a text block, considers its work done, and stops — never calling `finish()`.

## Evidence

**100% of failing sessions** (34/35 in the last 7 days) end with QA outputting a text message containing the exact Summary/Checks/Issues/Verdict format from SOUL.md. The last assistant message has text with "Verdict: PASS/CONDITIONAL/FAIL" but zero tool calls.

Sessions examined:
- s_1775944422179_1643: ends with "### Verdict\n**CONDITIONAL**..."
- s_1775940821962_1620: ends with "### Verdict\n**CONDITIONAL**..."
- s_1775930022165_1554: ends with "### Verdict\n**CONDITIONAL**..."
- s_1775919220629_1475: ends with "### Verdict\n**CONDITIONAL**..."
- s_1775888619847_1260: ends with "### Verdict\n**CONDITIONAL**..."
- s_1775899420780_1332: ends with "### Verdict\n**PASS**..."

Only 1/35 failures was Mode B (called finish() but got blocked by FM-3.3 verification guard).

## Failure Mode Breakdown

| Mode | Count | % | Description |
|------|-------|---|-------------|
| A: Text verdict, no finish() | 34 | 97% | QA outputs SOUL.md's Output Format as text and stops |
| B: finish() blocked by guard | 1 | 3% | Called finish() but FM-3.3 guard rejected it |

## Fix: Rewrite Output Format Section

The Output Format section should redirect the verdict INTO the finish() call rather than as standalone text. Replace:

```markdown
## Output Format
### Summary — One paragraph: what changed...
### Checks — tsc --noEmit: PASS/FAIL...
### Issues — Each with severity...
### Verdict — PASS / FAIL / CONDITIONAL
```

With:

```markdown
## Output Format — via `finish()` (never as text)

Your review output goes INTO the `finish()` call, not as a text message. Structure your summary as:

> **Verdict: PASS/FAIL/CONDITIONAL** — [one paragraph: what changed, does it work]. tsc: PASS/FAIL. vitest: PASS/FAIL (N tests). [Issues with severity, or "No issues found".]

Then call `finish()` — this IS your output:
\`\`\`js
finish({
  status: 'success',   // you completed the review (even if verdict is FAIL)
  summary: 'Verdict: CONDITIONAL — Reviewed <commit>. tsc PASS. vitest FAIL (pre-existing). One IMPORTANT issue: ...',
  deliverables: [{ path: 'workspace/journal.md', description: 'Appended findings' }],
  verification_evidence: ['Step N: bash(tsc) exit code 0']
})
\`\`\`
⚠️ **Do NOT write your verdict as a text message.** The finish() summary IS your verdict. Writing a text verdict and stopping is the #1 convention violation.
```

This fix redirects the same cognitive pattern (write a verdict) into the correct action (call finish with verdict as summary).

## Timeline

| Period | C1.4 Pass Rate |
|--------|---------------|
| All time (2670 checks) | 87.6% |
| Last 14d | 87.9% |
| Last 7d | 86.1% |
| Last 48h | 76.4% (anomalous spike) |
| Last 24h | 82.8% |
| After heartbeat fix (Apr 12+) | 88.0% |

The heartbeat fix (adding separate EXIT step) improved things marginally (86% → 88%), but the SOUL.md Output Format section continues to override it.

## Why Heartbeat Fix Was Insufficient

The heartbeat says "NEVER end with a text message. Your last action must be `finish()`." But the SOUL.md Output Format section implicitly tells QA to produce a text report. The model resolves the conflict by following SOUL.md (which defines its identity) over heartbeat.md (which is transient session instructions).

SOUL.md is the higher-authority document in the agent's cognitive hierarchy.
