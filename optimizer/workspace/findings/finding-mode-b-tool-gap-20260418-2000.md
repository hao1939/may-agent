# Finding: Tool Gap Analysis — 2026-04-18T20:00Z (6h scan)

## Sessions Analyzed (opCount > 5, last 6h)
| Session | Agent | Ops | Task Summary |
|---------|-------|-----|-------------|
| s_1776540115465_532 | coach | 65 | Investigate use-persistent-task gym failures |
| s_1776533063825_448 | coach | 51 | use-persistent-task structural intervention |
| s_1776528371364_380 | optimizer | 24 | Mode B tool gap analysis |
| s_1776524072374_316 | coach | 23 | breadcrumb-gap debugging |
| s_1776528382072_381 | scout | 22 | Weekend targeted search |

## Pattern 1: Gym Run Result Hunting (RECURRING — same as 18:00Z scan)
**Frequency**: 2/5 sessions (coach 65-op and 51-op), ~10-15 bash calls each
**Pattern**: Run gym scenario → hunt through `/tmp/gym-run-*` and `/tmp/gym-batch-*` dirs for results → read judge-verdict.json → grep transcript — repeated multiple times per session.

The 65-op coach session investigated gym scenario failures and likely spent significant ops on this pattern. This is the **same pattern** identified in the 18:00Z scan, confirming it's persistent.

**Status**: Still the #1 tool gap. `scripts/gym-inspect.sh` recommendation stands.

## Pattern 2: DB Schema Discovery Before Queries
**Frequency**: 3/5 sessions (optimizer, coach, tech-lead)
**Pattern**: `PRAGMA table_info(...)` → construct query → fix column name → re-query. Agents spend 2-3 calls per novel query just discovering schema.

**Existing**: Schema is documented in context.md for optimizer. Other agents may lack it.

**Recommendation**: LOW — this is already mitigated by context.md schema docs. Ensure all agents have the key table schemas in their context.

## Pattern 3: No New High-Impact Patterns
The session mix is dominated by coach gym work (same pattern as before) and optimizer self-scans. No new multi-step bash patterns emerged in this window.

## Summary
| Pattern | Status | Priority |
|---------|--------|----------|
| Gym result inspection | RECURRING (confirmed 2 scans) | **HIGH** — escalate to tech-lead |
| DB schema discovery | Mitigated by context.md | LOW |

**Conclusion**: The gym-inspect tool gap is the only significant finding, confirmed across two consecutive Mode B scans. No new patterns discovered in this 6h window.
