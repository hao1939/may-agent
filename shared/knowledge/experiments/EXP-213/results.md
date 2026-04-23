# EXP-213: Results — Schema-Organized Context for Bob

**Status**: COMPLETE — Results below
**Deployed**: 2026-04-23 (commit 63c24830c)
**Predecessor**: EXP-212 (confirmed: schema reduced tech-lead C1.1 by 54%, git confusion by 50%, npx by 63%)

## Deployment

Bob's context.md reorganized into activation-based schema sections:
- `## ⚡ [SESSION START]` — environment, tools, paths
- `## ⚡ [BEFORE EDITING ANY FILE]` — C1.1 read-before-edit
- `## ⚡ [AFTER EVERY write() CALL]` — C1.3 verify-after-write
- `## ⚡ [BEFORE CALLING finish()]` — C1.7, C12.1
- `## ⚡ [RESEARCH WORKFLOW]` — KB paths, scripts, gym
- `## ⚡ [GENERAL KNOWLEDGE]` — findings, preferences

Same content. Zero new facts. Only structural reorganization matching activation context.

## Pre-Deployment Baseline (days 3-10 before deploy)

| Convention | Fail | Pass | Total | Fail Rate |
|-----------|------|------|-------|-----------|
| C1.1 | 61 | 558 | 619 | 9.9% |
| C1.3 | 61 | 558 | 619 | 9.9% |

## Post-Deployment Data (measured 2026-07-29, ~13 weeks post-deploy)

N=1628 post-deploy convention checks for bob.

| Convention | Fail | Pass | Total | Fail Rate |
|-----------|------|------|-------|-----------|
| C1.1 | 185 | 1443 | 1628 | 11.4% |
| C1.3 | 208 | 1420 | 1628 | 12.8% |

### Weekly Trend

| Week | C1.1 Fail Rate | C1.3 Fail Rate | N |
|------|---------------|---------------|---|
| W12 (pre-deploy) | 59.5% | 84.9% | 205 |
| W13 (pre-deploy) | 13.3% | 25.3% | 166 |
| W14 (post-deploy) | 7.9% | 1.8% | 570 |
| W15 (post-deploy) | 9.7% | 9.0% | 710 |
| W16 (post-deploy, partial) | 13.1% | 19.6% | 107 |

### Assessment

**C1.1 (read-before-edit)**: Pre-deploy baseline was 9.9% (design doc cited 13.8%). Post-deploy 11.4%. **No improvement** — in fact slightly worse. The schema reorganization did NOT reduce C1.1 violations for bob.

**C1.3 (verify-after-write)**: Pre-deploy baseline was 9.9% (design doc cited 13.5%). Post-deploy 12.8%. **No improvement** — slightly worse.

**Success criterion NOT MET**: Required ≥30% reduction (to ≤6.9%). Neither convention improved.

### Interpretation

The schema reorganization that worked dramatically for tech-lead (EXP-212: −54% C1.1) did NOT transfer to bob. Two possible explanations:

1. **Ceiling effect**: Bob's pre-deploy rate (9.9%) was already much lower than tech-lead's pre-deploy rate, leaving less room for improvement. The schema may help agents with HIGH violation rates but not those already near baseline.

2. **Agent-specific failure modes**: Bob's C1.1/C1.3 violations may stem from different causes than tech-lead's (e.g., research-mode time pressure, multi-file workflows) that schema activation framing doesn't address.

3. **Confound**: The pre-deploy baseline window (W13-W14) may have been artificially low, masking the true baseline. W12 shows 59.5%/84.9% — suggesting a recent improvement unrelated to schema that already captured the easy gains.

**Verdict**: EXP-213 is a **NULL RESULT** for bob. Schema reorganization is agent-specific in its effectiveness — validates for tech-lead (EXP-212) but not for bob. This is consistent with H-095 (agent-specific interventions > universal approaches).

## Connection to Hypothesis Corpus

- **H-095** (agent-specific interventions): Strengthened. Same intervention, different agents, different outcomes.
- **H-098** (Attention Channel Theory): Schema reorganization is a Ch1 intervention (restructuring text). Ch1's inconsistent effectiveness is expected.
- **H-101** (Architectural Readiness): Bob may already have sufficient architectural readiness for C1.1/C1.3 (he has the skills), making further text-level nudges redundant.
