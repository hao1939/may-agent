# Convention Regression Analysis — 2026-04-05

## Triggered by
Convention-check alerts: tech-lead C1.1 (89.3%), tech-lead C6.1 (89.3%), qa C1.4 (87.8%)

## Data Analysis

### tech-lead C1.1: Read Before Edit

**Compliance**: 80% last 24h (12/15), 79.4% all-time (139/175) — **stable, NOT a regression**

The alert was triggered by a snapshot window. Looking at the full data, tech-lead has been around 80% for weeks. However, 80% is below our 95% target.

**Fresh violations (today)**:
| Session | Violations |
|---------|-----------|
| s_1775386763100_7 | edit(src/lib/overflow.ts) + edit(test/silent-error.test.ts) without prior read |
| s_1775384785801_1 | edit(test/session-digest-switchover.test.ts) without prior read |
| s_1775382044903_155 | edit(src/lib/session-digest.ts) + edit(test-digest.ts) x2 without prior read |

**Pattern**: tech-lead edits source files AND test files without reading them first. Common in coding sessions where tech-lead does direct implementation (vs delegating to coder). The violations affect both src/ files and test/ files.

**Existing skill**: `coder-edit-discipline` is proven for coder (3/3 gym pass, 11/11 checks). The skill file already notes tech-lead has only 45% historical compliance — making it a prime deployment target.

**Recommendation**: Deploy `coder-edit-discipline` to tech-lead as `read-before-edit.md` skill file in `agents/tech-lead/skills/`. This is a **Process skill** (adding a step before edit), which is our highest-confidence intervention type. No gym test needed — the skill is already proven on the identical behavior for coder.

### tech-lead C6.1: Budget Awareness (Tool Call Budget)

**Compliance**: 73.3% last 24h (11/15), 68% all-time (119/175) — **slightly improved, NOT a regression**

**Fresh violations (today)**:
| Session | Violation |
|---------|-----------|
| s_1775386763100_7 | 105 tool calls (likely hitting budget limit) |
| s_1775384785801_1 | 87 tool calls (likely hitting budget limit) |
| s_1775382044903_155 | 163 tool calls! |
| s_1775382044903_155 | 102 tool calls |

**Tension**: tech-lead context.md says "opBudget removed — do not implement tool call limits. Agents should take as many ops as needed." This directly conflicts with C6.1 monitoring. The sessions with 87-163 tool calls may be legitimate complex implementation work, not waste.

**Existing skill**: `budget-before-act` exists but is untested and targets a different issue (FM-3.1 premature termination, not over-spending).

**Recommendation**: **No action**. The C6.1 violations reflect the deliberate "no opBudget" policy. Tech-lead is doing complex multi-file implementations that genuinely require many tool calls. If we want to reduce tool calls, we should:
1. Improve delegation to coder (offload implementation work)
2. Address the root cause: tech-lead sessions that should be coder sessions

### qa C1.4: Finish Clearly

**Compliance**: 90.5% last 24h (19/21), 57.9% all-time (173/299) — **IMPROVING, not regressed**

The last C1.4 violation was 2026-04-04 12:15 — over 23 hours ago. The recent data shows qa has significantly improved from 57.9% to 90.5%.

**Recommendation**: **No action needed** — trend is positive. Continue monitoring.

## Action Plan

| Item | Priority | Action | Expected Impact |
|------|----------|--------|-----------------|
| tech-lead C1.1 | P1 | Deploy read-before-edit skill to tech-lead | 80% → 90%+ (based on coder improvement) |
| tech-lead C6.1 | P2 | No action (conflicts with no-opBudget policy) | N/A |
| qa C1.4 | P3 | No action (already improving) | Already at 90.5% |

## Deployment: read-before-edit for tech-lead

Create `agents/tech-lead/skills/read-before-edit.md` adapted from `coder-edit-discipline/SKILL.md`:
- Rename for tech-lead context
- Adjust "When to Apply" to include tech-lead's direct-coding pattern
- Keep the core rule: read() before every edit()
- Include tech-lead-specific anti-pattern: "editing test files you wrote in a prior delegated session"
