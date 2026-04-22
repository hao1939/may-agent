# KE-023: Read-Before-Edit Skill Deployment Shows No Production Improvement

**Evidence-Grade:** C — Confounded by concurrent regression, premature conclusion

**Status**: preliminary (needs larger sample)  
**Evidence**: Convention compliance data 2026-04-02 through 2026-04-05, skill deployments to 4 agents  
**Discovered**: 2026-04-05  
**Last verified**: 2026-04-05  
**Cross-reference**: EXP-142 (cache-first retrieval validation) provides indirect support — cache-first strategy showed 78% hit rate and 62% latency reduction, suggesting that retrieval infrastructure (not skill text deployment) may be the key bottleneck. Consistent with KE-023's finding that passive skill deployment is ineffective in production.

## Claim

The read-before-edit process skill, despite being deployed to scout, tech-lead, bob, and may (2026-04-04/05), shows **no measurable improvement** in production C1.1 compliance. A system-wide C1.1 regression occurred concurrently, and the skill did not arrest or reverse it.

## Evidence

### C1.1 Compliance Trend (4-day window)

| Agent | Apr 2 | Apr 3 | Apr 4 (scout deployed) | Apr 5 (others deployed) |
|-------|-------|-------|------------------------|------------------------|
| Scout | 75% (6/8) | 40% (2/5) | 18% (2/11) | 38% (3/8) |
| May | 100% (27/27) | 100% (13/13) | 81% (21/26) | 67% (10/15) |
| Tech-lead | 86% (6/7) | 100% (2/2) | 100% (10/10) | 55% (6/11) |
| Bob | 100% (30/30) | 88% (14/16) | 70% (14/20) | 74% (17/23) |

### Control Convention (C1.7 — no skill deployed)
| System-wide | Apr 2 | Apr 3 | Apr 4 | Apr 5 |
|-------------|-------|-------|-------|-------|
| C1.7 | 99% | 98% | 97% | 97% |

C1.7 remained stable — the regression is specific to C1.1 (read-before-edit).

### Key Observations

1. **The regression preceded deployment** for scout and bob — their C1.1 was already declining before the skill was added
2. **The regression appeared AFTER deployment** for may (100→67%) and tech-lead (100→55%) — but this may be coincidence since bob also declined without the skill initially
3. **The skill did NOT cause the regression** — it was already happening systemically
4. **The skill did NOT fix the regression** — no measurable improvement post-deployment
5. **No regression in unrelated conventions** — C1.7 stable at 97-99%

## Possible Explanations

1. **System-wide prompt or context change** around Apr 3-4 affected all agents' edit-before-read behavior
2. **Skill is too passive** — read-before-edit is a process skill but agents are in complex multi-file editing sessions where the skill text is buried in a long system prompt
3. **Skill works in gym but not production** — gym scenarios are short/focused; production sessions have many competing priorities
4. **Sample size too small** — daily windows have 5-30 checks; variance is high

## Implications

1. **Gym results don't guarantee production improvement** — the read-before-edit scenario scored 11/11 with the skill loaded, but production compliance is declining
2. **Production deployment needs its own measurement protocol** — not just "deploy and hope"
3. **Process skills may have a ceiling in production contexts** that doesn't appear in controlled gym settings
4. **Investigation needed**: what specifically changed around Apr 3-4 that triggered the system-wide C1.1 decline?

## Related
- KE-021: Skill effectiveness taxonomy (process > knowledge > judgment)
- KE-007: Workflow enforcement is the only reliable behavioral intervention
- KE-011: Knowledge files are passive — agents skip them in oneshot mode
- EXP-035: stale-error-misdiagnosis baseline ceiling
- EXP-142: Cache-first retrieval strategy validation (H-042) — supports retrieval infrastructure > passive text deployment
