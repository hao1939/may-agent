# Mode A: Session Archaeology — 6h Scan (Apr 18 ~15:30 UTC)

## Summary

Scanned sessions from last 6h. **Tech-lead is the primary quality drag** (avg 0.686, min 0.05 across 23 sessions). Coach 57-op session is legitimate (q=1.0). Two coach sessions at q=0.34 are waste from task/process mismatch.

## Key Findings

### 1. Coach 57-op Session (s_1776515111675_166) — LEGITIMATE
- Task: "Complete metric-reaction scenario and run baseline"
- Quality: 1.0, verdict: good
- This is gym scenario creation + baseline running — inherently expensive. No action needed.

### 2. Quality-Preserved Metric (0.891 vs 0.9 target) — Root Cause: Tech-Lead

Agent quality averages (last 6h, excluding evaluator):

| Agent | Sessions | Avg Quality | Min Quality |
|-------|----------|-------------|-------------|
| tech-lead | 23 | 0.686 | 0.05 |
| coach | 33 | 0.827 | 0.34 |
| bob | 33 | 0.831 | 0.00 |
| optimizer | 22 | 0.885 | 0.55 |
| scout | 15 | 0.901 | 0.15 |
| qa | 11 | 0.960 | 0.84 |
| may | 16 | 1.000 | 1.00 |

**Tech-lead at 0.686 is the clear outlier** dragging system quality below 0.9. With 23 sessions, this has significant weight. A tech-lead session scored 0.05 (near zero).

### 3. Low-Quality Sessions — Patterns

- **s_1776506480342_96** (tech-lead, 22 ops, q=0.32): D-o-R budget violation — exceeded Phase 1/2 op caps, multiple exploratory DB attempts. This is the known P1-bloat pattern recurring.
- **s_1776518709125_231** (coach, 49 ops, q=0.34): FM-2.6 reasoning/action mismatch — task asked to design+build a new scenario but session modified an existing one instead.
- **s_1776520784207_253** (coach, 20 ops, q=0.34): Process instruction violation — didn't follow explicit intervention protocol.

### 4. Session Volume by Agent (6h)

| Agent | Sessions | Total Ops (>10) |
|-------|----------|-----------------|
| coach | 33 | ~400+ |
| bob | 33 | ~200+ |
| tech-lead | 23 | ~130+ |
| optimizer | 22 | ~60+ |
| may | 16 | ~60+ |
| scout | 15 | ~80+ |

## Dispatch Decision: NO_DISPATCH

Tech-lead quality issue is the most impactful finding but it's a known pattern (D-o-R budget violations). The P1 budget cap fix was already deployed for bob — need to verify tech-lead has equivalent guardrails. This is worth a P2 investigation next rotation, not urgent dispatch.

## Action Items
- Monitor tech-lead quality in next scan — if still <0.7, escalate
- Coach 0.34-quality sessions are one-offs (task mismatch), not systematic
