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

## Skill Effectiveness
- **90% pass rate** on recent graded evals after skill updates (11 good, 7 acceptable, 2 needs_improvement out of 20).
- Zero recurrence of addressed failure modes after March 12, 2026.
- Skills library: 12 SKILL.md files total as of May 2026.

## Behavioral Change Effectiveness Hierarchy
Evidence from 38+ coach experiments and gym testing (2026-03-20):
- **Workflow enforcement (92%)**: Two-phase tasks (investigate → fix) mechanically force process compliance. Transforms 0% → 100% on process checks.
- **Task instructions (33%)**: Inline directives in task descriptions have moderate effect.
- **SOUL.md text (~0%)**: Editing SOUL.md has near-zero behavioral impact — the authority hierarchy problem.
- **Skill documents (0% currently)**: Shared SKILL.md files are NOT loaded into agent runtime context. Agents don't know they exist during sessions. No skill injection mechanism exists yet.

**Implication**: For behavioral fixes, create **workflow-enforced gym scenarios** (separate Phase 1/Phase 2 tasks) rather than skill documents. Skills remain useful as reference/documentation but don't directly change agent behavior.

## Skill Deployment Gaps
- **classify-then-act skill**: Failed 0/3 gym tests (2026-03-20). Pattern is correct (Method #15, backed by 92% success rate), but no runtime injection mechanism. Don't attempt skill-only deployment until a skill-loader exists.
- **Per-agent tailoring**: INDEX.md skill entries should highlight patterns specific to each agent's failure history, not generic references. Applied to error-handling v1.3.0 across 8 agents.

## Key Insight
- Path hallucination (146+ instances) remains the top systemic issue but is **coaching-level, not code-fixable**.
- `exec` tool dominates failure chains (694/1156 triggers).
- Empty-args tool calls (77 in chains) and path hallucination (146 in chains) are pre-existing coaching issues.
