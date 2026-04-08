# May's Supervisory Dashboard

Updated: 2026-04-08 ~05:00 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **All other 8 agents**: 🟢 Running normally

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production (NEW — Hao's directive)
4. Session digest system as unified recovery
5. Design docs before implementation

## What I'm Watching
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| Knowledge Application Audit | ✅ Complete | bob | 3 major gaps identified (KE-025, KE-029, KE-056) |
| KE-025 Skill Pruning | ✅ Complete | optimizer | Coach: 20→4 files (84%), Evaluator: 13→6 files (33%) — 90KB removed |
| EXP-075 CTA deployment | ✅ Complete | coach/may | Skill deployed (commit 188b98fe), SOUL.md updated (commit 6966f743) |
| EXP-076 Workflow audit | ✅ Phase 2 SHIPPED | may | Bob: workflow tool + heartbeat instruction deployed (commit 14c55c82). Monitor next 10 WORK SESSIONs. |
| EXP-077 Gym fidelity | 🟡 Designed | coach | Build gym scenarios that predict production behavior |
| KE-SUMMARIES completion | ✅ Done | bob | Extended 19→57 entries, all KEs covered + INDEX fixed |
| H-087 P3 retrospective | ✅ Done | bob | Designed experiments 2.05x more likely to produce KEs |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| Code cleanup — green items | ✅ Done | tech-lead | 8 files, -404 lines (commit bacdecd) |
| Code cleanup — medium items | ✅ Done | tech-lead | 4 files, +43/-37 lines (commit f7cf01b) — getAgentDir, BASH_WRITE_PATTERNS, loaded[] simplification, re-export consolidation |
| Code cleanup — architecture review | ✅ Done | bob | Reviewed requests.ts lazy/eager + loaded[] — both safe to simplify |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
| Knowledge application audit | Apr 8 | Bob: KNOWLEDGE-APPLICATION-AUDIT.md — 3 gaps, 4 recommendations |
| Sprint 31 experiment designs | Apr 8 | Coach: EXP-075/076/077 designed + sprint plan |
| KE-SUMMARIES 57/57 | Apr 8 | Bob: All knowledge entries now have summaries |
| H-087 P3 retrospective | Apr 8 | Bob: Designed exps 2.05x better (p≈0.013) |
| finish() commit guard | Apr 7 | **SHIPPED** — commit 5babdf8, L5 enforcement for agent git commits |
| KE-053 Competency-Production Gap | Apr 7 | Bob synthesized EXP-065/066 findings (22 ops) |
| Workflow adoption investigation | Apr 7 | Optimizer: workflows were running but DB metadata was broken (fixed) |
| Agent busywork fix | Apr 6 | All 3 agents fixed — journal refs removed |
| Research DB tables | Apr 7 | knowledge, hypotheses, experiments tables live |
| Session digest Phases 1-4b | Apr 6 | Shipped and working |
| Anti-busywork campaign | Apr 6 | Bob, Coach, Optimizer heartbeats fixed |

## Latest Cycle Summary (05:00)
- **Code Cleanup SHIPPED**: Green (dead code removal, -404 lines) + Medium (helper extraction, +43/-37) — both merged, 2014 tests pass
- **Bob Architecture Review**: requests.ts lazy→eager + loaded[] → static string — both verified safe for tech-lead to implement
- **Optimizer Code Hygiene**: Added as recurring responsibility in SOUL.md + heartbeat.md (commit df004e3)
- **System Health**: Zero errors across all agents. All agents self-dispatching.
- Amy-kimi still 🔴 DOWN

## Next Actions
- **P1**: Code cleanup — larger items: requests.ts lazy→eager (4 files), loaded[] simplification (per Bob's review)
- **P1**: Monitor Bob's next 10 WORK SESSIONs for workflow adoption + error rate change (EXP-076 Phase 3)
- **P1**: Constraint hierarchy gate in intervention design process — bob
- **P2**: EXP-077 gym fidelity ladder — coach (can parallel with P1 items)
- **P2**: QA workflow expansion (EXP-076 Phase 2b) — contingent on Bob results
