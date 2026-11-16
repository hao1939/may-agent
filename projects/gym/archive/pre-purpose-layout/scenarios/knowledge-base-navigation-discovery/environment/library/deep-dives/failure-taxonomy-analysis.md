# Deep Dive: Failure Mode Taxonomy Analysis

**Date**: 2026-03-12
**Author**: Research Team

## Overview

This analysis classifies agent failure modes into three tiers based on observational data from 500+ production sessions.

## Taxonomy

### Tier 1: Process Failures (FM-1.x)

| FM | Name | Description | Frequency |
|----|------|-------------|-----------|
| FM-1.1 | Incomplete verification | Agent doesn't verify its work | Medium |
| FM-1.2 | Infinite retry loops | Agent retries the same approach 5+ times | Low |
| FM-1.3 | Path-guessing / flailing | Agent constructs file paths from memory | **High** |
| FM-1.4 | Premature optimization | Agent optimizes before understanding | Low |

### Tier 2: Coordination Failures (FM-2.x)

| FM | Name | Description | Frequency |
|----|------|-------------|-----------|
| FM-2.1 | Scope creep | Agent expands beyond assigned task | Medium |
| FM-2.5 | Missing handoff context | Agent doesn't provide enough context on handoff | Medium |
| FM-2.6 | Delegation instead of execution | Agent delegates work it should do itself | **High** |

### Tier 3: Delivery Failures (FM-3.x)

| FM | Name | Description | Frequency |
|----|------|-------------|-----------|
| FM-3.1 | Non-delivery | Agent does work but doesn't persist results | Medium |
| FM-3.2 | Partial delivery | Agent delivers incomplete results | Low |

## Cross-References

- FM-1.3 is the target of multiple intervention experiments — see RH-044, RX-055, RX-058
- FM-2.6 was investigated in a separate study (see experiments/)
- FM-3.1 has a deployed workflow guard (deliver-or-report)

## Key Insight

FM-1.3 (path-guessing) is unique because the agent possesses the correct knowledge (skill file says "ls before read") but fails to apply it. This makes it a BEHAVIORAL problem, not a KNOWLEDGE problem — and per RKE-007, behavioral problems require structural interventions.

## Recommendations

1. **FM-1.3**: Phase 0 discovery pre-phase (structural enforcement)
2. **FM-2.6**: Task decomposition guard (pending design)
3. **FM-3.1**: Already addressed by deliver-or-report workflow guard
