# KE-288 — Task-Type Topology Sensitivity: Four Convergent Axes

**Rating**: ★★★★ (strongly supported, not yet directly tested)
**Date**: 2026-04-22
**Source**: H-163 evidence scan (Scout 2026-04-18), KE-192, KE-196, KE-200, KE-206
**Tags**: #intervention-design #task-type #topology #meta-finding

---

## Claim

Intervention effectiveness is not a property of the intervention alone — it depends on **task type** along at least four independent axes. The same intervention can range from 0% to 100% effectiveness depending on which axis the task sits on.

## The Four Axes

| Axis | Source | What Varies | Example |
|------|--------|-------------|---------|
| 1. **Solver vs Sampler** | KE-192 | Process guards work for solver tasks, fail for sampler (recognition/architectural) tasks | Cascading-fix-trap (solver) vs sql-injection (sampler) |
| 2. **Easy vs Hard** | KE-196 | Displacement: 0pp on easy tasks, 93pp on hard — same ext intervention | EXP-166 content-first guard results |
| 3. **Recognition vs Optimization** | KE-192 + EXP-167 | Monitoring approach must match: probe-based for hard recognition, LLM-companion for easy optimization | KE-200 (DD-770) |
| 4. **Information vs Behavioral** | KE-206 | KV cache injection works for info-seeking, fails for behavioral change | DD-766 passive injection experiments |

## Why This Matters

- **Design implications**: No single intervention topology is universal. Task classification MUST precede intervention selection.
- **Extends KE-016**: KE-016 identified decision-type sensitivity (helps 40%, hurts 40%). KE-288 generalizes this to four independent axes.
- **Explains contradictions**: Many "failed replications" in our experiment history (e.g., ext works for sycophancy but not debugging, KE-054) are task-type effects, not intervention failures.

## Connections

- H-163 (task-type topology sensitivity) — P(H) recommended update: 0.60 → 0.70
- KE-054 (ext boundary: judgment vs debugging) — axis 1 instance
- KE-056 (constraint hierarchy) — axis 2 instance
- WKWA-008 (channel theory) — channel × task type interaction

## Next Test

Hold intervention constant, vary task type across all 4 axes. If displacement varies >30pp across types, H-163 confirmed.
