# Failure Patterns & Skill Coverage

## Top Failure Modes (by frequency, from 1600+ evals)
1. **NON_DELIVERY** (33 occurrences, 7 agents) — agents burn turns reading/planning, never persist output.
2. **VERIFICATION cluster** (26 total: VERIFICATION_FAILURE 11, VERIFICATION_GAP 10, INSUFFICIENT_VERIFICATION 5) — across 7 agents, coder worst (14).
3. **HALLUCINATION** (18) — path hallucination is the #1 variant (146+ historical instances). Coaching-level, not code-fixable.
4. **HARD_CONSTRAINT_VIOLATION** (20), **EFFICIENCY** (19), **SILENT_FAIL** (12), **TOOL_MISUSE** (10).

## Skills Added to Address These
All top failure modes now have corresponding skill anti-patterns:

| Failure Mode | Skill File | Anti-Pattern |
|---|---|---|
| SILENT_FAIL | error-handling/SKILL.md | "Tool Abort → Silent Abandon" + Acknowledge→Pivot→Escalate protocol |
| NON_DELIVERY | error-handling/SKILL.md | "Exploration Without Output" + "Planning Without Executing" |
| VERIFICATION_FAILURE | verification/SKILL.md | AP-6 "Wrong Target", AP-7 "Proceed Despite Red Flags", AP-8 "Truncated Verification", AP-9 "Selective Verification" |
| DATA_LOSS | file-safety/SKILL.md | AP-1 "Output-Truncated Write", AP-2 "Shrink Guard Bypass via Shell" |

## Recently Deployed Skills (March 2026)
| Skill | Version | Gym Result | Deployed To | Date |
|---|---|---|---|---|
| task-adherence | 1.0.0 | Pre-validated (existing) | 6 agents (bob, coach, coder, may, optimizer, tech-lead) | 2026-03-23 |
| verification-consistency | 1.0.0 | 3/3 (100%) | 6 agents (bob, coach, coder, optimizer, scout, tech-lead) | 2026-03-23 |
| progressive-work-persistence | 1.0.0 | 3/3 (100%) | 6 agents (bob, coach, coder, optimizer, scout, tech-lead) | 2026-03-24 |
| deliverable-integrity | 1.0.0 | 3/3 (100%) | self + 8 agents via May request | 2026-03-24 |

## Skills That Failed Deployment
| Skill | Gym Result | Reason | Fix Path |
|---|---|---|---|
| prerequisite-gap-protocol | 0/3 (0%) | Agent claims success despite detecting missing prereq; skill not injected into prompt | Behavioral skills need prompt injection, not just reference docs |
| verification | 1/6 (17%) | `hasVerificationAfterWrite` criteria only recognizes read()/cat/head, not python3-based validation | Update gym criteria to accept python/node file reads as valid verification |

## Skill Effectiveness
- **90% pass rate** on recent graded evals after skill updates (11 good, 7 acceptable, 2 needs_improvement out of 20).
- Zero recurrence of addressed failure modes after March 12, 2026.
- Skills library: 15+ SKILL.md files as of March 2026.

## Key Insights
- Path hallucination (146+ instances) remains the top systemic issue but is **coaching-level, not code-fixable**.
- `exec` tool dominates failure chains (694/1156 triggers).
- Empty-args tool calls (77 in chains) and path hallucination (146 in chains) are pre-existing coaching issues.
- **Behavioral skills as reference docs don't change agent behavior** — the agent's default success-bias overrides skill guidance when skill isn't in the prompt. Skills deployed via SOUL.md guard lines are more effective.
- **Gym criteria can produce false negatives** — if success criteria are too narrow (e.g., only recognizing `read()` for verification), valid agent behavior gets scored as failure. Always check LLM judge results alongside automated checks.
