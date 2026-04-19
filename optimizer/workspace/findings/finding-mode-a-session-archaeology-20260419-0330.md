# Finding: Session Archaeology — 6h Scan (2026-04-19 03:30)

## Summary
5 high-op sessions in the last 6h. One critical failure (coach 64-op timeout storm), one bloated-but-ok session (coach 154-op), and three acceptable sessions with known friction patterns.

## High-Op Sessions

| Session | Agent | Ops | Verdict | Key Issue |
|---------|-------|-----|---------|-----------|
| s_1776563469482_804 | coach | 64 | parse_error (q=0.22) | Timeout storm — gym runs kept timing out, never completed 10-trial measurement |
| s_1776551125350_659 | coach | 154 | good (q=0.75, e=0.80) | High ops but evaluated as productive; structural intervention analysis |
| s_1776558283950_741 | coach | 31 | good (q=1.0) | Clean session, no issues |
| s_1776550965464_657 | bob | 48 | acceptable (q=0.62) | Path assumptions, git-ignore friction, verification gaps |
| s_1776549194591_638 | bob | 26 | acceptable (q=0.83) | Path discovery mistakes, sqlite3 CLI attempts |

## Analysis

### Coach 64-op timeout storm (CRITICAL)
- **Root cause**: EXP-186 required running gym-batch which timed out at 600s, then 900s. Agent kept retrying without adjusting approach.
- **Pattern**: Known — FM-1.3 timeout/retry spiral. Agent should abandon gym runs after 2 timeouts and report partial results.
- **Impact**: Session interrupted with q=0.22, no deliverables completed.

### Coach 154-op session (EXPECTED)
- **Verdict**: good (q=0.75, e=0.80) despite 154 ops. Evaluator flagged only "high_op_count."
- **Interpretation**: This was a complex analysis task (persistent-task structural intervention failure). The high op count reflects genuine complexity, not waste. Efficiency 0.80 confirms most calls were productive.
- **No action needed**.

### Bob sessions (KNOWN FRICTION)
- Both bob sessions show repeated known patterns: wrong path assumptions (FM-1.3), sqlite3 CLI attempts despite env constraint, git-ignore confusion.
- These are persistent bob-specific friction patterns, not new issues.

## Conclusions
- **New pattern?** No — all issues are known (timeout storms, path assumptions, env friction).
- **Action items**: The coach timeout storm (EXP-186) suggests gym-batch tasks need a timeout budget cap or early-abort heuristic, but this is a coach-level concern, not an optimizer intervention.
