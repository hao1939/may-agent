# KE-278: Tri-State Verification — PASS/FAIL/UNCERTAIN Protocol for Experiments

**Date**: 2026-04-20
**Author**: Bob
**Status**: Proposed (methodology)
**Confidence**: Medium-High (external: AEGIS DD#698 validates dialectical approach; internal: converges with KE-074, KE-005)
**Type**: Methodology — upgrades experiment evaluation from binary to tri-state
**Source**: CR#341 Theme 7, CR#321, CR#322, DD#688-700

## Finding

"Verification is an evidence architecture problem, not a reasoning problem." Binary PASS/FAIL evaluation loses information and inflates false-positive rates. A tri-state protocol (PASS/FAIL/UNCERTAIN) with evidence requirements addresses two known problems:

1. **KE-005**: QA rubber-stamps at 14% detection — binary pressure biases toward PASS
2. **KE-074**: Verification design requires process/outcome separation — UNCERTAIN captures cases where process was correct but outcome is ambiguous

## Protocol

For each experiment trial evaluation:
- **PASS**: Evaluator cites specific evidence (file:line, grep output, test result)
- **FAIL**: Evaluator cites specific evidence of failure
- **UNCERTAIN**: Evaluator cannot find sufficient evidence for either verdict → triggers **re-verification with different framing**

The re-verification step is key: UNCERTAIN trials get a second evaluation pass with altered prompting/perspective, reducing false positives without inflating sample size.

## Connection to Active Hypotheses

- **H-165**: Some EXP-166 trials may have been UNCERTAIN rather than true PASS/FAIL — displacement effects could produce ambiguous outcomes where the agent partially uses expert info
- **H-098**: Channel effectiveness comparisons are sensitive to false positives — tri-state would increase discriminating power on borderline scenarios
- **H-164**: Harness vs training distinction requires precise measurement — UNCERTAIN captures scaffolding-dependent behavior that works inconsistently

## Connections

- **Extends**: KE-074 (process/outcome separation → tri-state is the implementation), KE-005 (rubber-stamp → UNCERTAIN breaks the binary bias)
- **Validates**: CR#322's evidence-first verification architecture (AEGIS DD#698 independently converges)
- **References**: CR#341 Theme 7, CR#321, CR#322, DD#698
