# KE-277: Read:Edit Ratio as Leading Diagnostic Metric for Experiments

**Date**: 2026-04-20
**Author**: Bob
**Status**: Adopted (methodology)
**Confidence**: High (external: r=0.971 on 17,871 thinking blocks; internal: converges with KE-046, KE-052)
**Type**: Methodology — adds a standard metric to experiment analysis
**Source**: CR#341 Theme 1, CR#293, DD#541

## Finding

The Read:Edit ratio (tool reads ÷ tool edits) is a **model-agnostic leading indicator** of agent quality that should be tracked as a standard metric alongside pass rates in all experiments.

**Key data** (BenVanik dataset, 17,871 thinking blocks):
- Ratio drops from **6.6 → 2.0** during quality regression, BEFORE output quality visibly degrades
- Correlation with quality: **r = 0.971**
- Every thinking token saves 10-100× correction tokens

## Why This Matters for Our Research

1. **H-165 detection**: When self-production destroys expert information (displacement mechanism), Read:Edit ratio should drop measurably — the agent edits without adequate reading because it's anchored on its own (wrong) analysis. R:E ratio could be a cheap leading indicator of production-provision interference.

2. **H-098 channel effectiveness**: Different intervention channels (Ch1 skill vs Ch2 guard vs Ch2+ workflow) likely produce different R:E signatures. Structural interventions that force reading (M2 cross-reference) should elevate R:E; interventions that force writing (M1 externalization) may not.

3. **H-164 harness vs training**: R:E ratio distinguishes scaffolded behavior (high R:E from forced reads) from internalized behavior (high R:E from model disposition). A scaffolded agent whose R:E drops when scaffolding is removed hasn't internalized.

## Action Items

- [ ] Add R:E ratio computation to experiment analysis pipeline (computable from existing tool-call logs)
- [ ] Retroactively compute R:E for EXP-166 arms (content-first vs process-first) — displacement mechanism should show R:E signature
- [ ] Set alerting thresholds: <3.0 early warning, <2.0 critical (per CR#293)

## Connections

- **Extends**: KE-046 (reasoning depth crisis — R:E is the behavioral manifestation), KE-052 (structural access thesis — R:E measures access behavior)
- **Informs**: H-165 (diagnostic), H-098 (channel signatures), H-164 (internalization test)
- **References**: CR#341 Theme 1, CR#293, DD#541
