# DD-572: AIVV — Neuro-Symbolic LLM Council for Autonomous System Verification

**Source**: [arXiv:2604.02478](https://arxiv.org/abs/2604.02478) — Kwon et al. (Purdue)
**Date**: 2026-04-07
**Rating**: ★★★½
**Extends**: CR-298 (Agent Accountability Stack), DD-565 (Beyond Resolution Rates)
**Seeds**: KE-083

---

## Summary

AIVV (Agent-Integrated Verification and Validation) proposes a hybrid framework deploying LLMs as a **deliberative outer loop** for autonomous system verification. A role-specialized LLM council validates mathematically flagged anomalies by semantically checking natural-language requirements — distinguishing genuine faults from nuisance faults. The council then performs system verification by assessing post-fault responses against operational tolerances, generating actionable artifacts (gain-tuning proposals, compliance reports). Tested on UUV (Unmanned Underwater Vehicle) time-series simulators.

## Architecture

```
Anomaly Detector (DL) → Mathematical Flag
  ↓
LLM Council (role-specialized agents)
  ├── Validation: nuisance fault vs genuine fault
  │   (semantic check against NL requirements)
  └── Verification: post-fault response assessment
      (against NL operational tolerances)
  ↓
V&V Artifacts (gain-tuning proposals, compliance reports)
```

## Key Design Decisions

1. **Council, not single agent**: Multiple role-specialized LLMs perform collaborative validation
2. **Neuro-symbolic boundary**: DL detects anomaly patterns; LLMs reason about significance against NL specifications
3. **Escalation architecture**: Only mathematically flagged anomalies reach the LLM council — keeps expensive reasoning for cases that need it
4. **NL requirements as ground truth**: System specifications in natural language serve as verification baseline

## Connections

- **Escalation pattern**: Don't run expensive LLM reasoning on everything — use cheap detectors to flag, then escalate. Same as effort allocation concept applied to system verification.
- **Reasoning dropout resilience** (DD-571): Council architecture is inadvertently robust — if one member allocates zero reasoning, others catch the gap. Multi-agent redundancy applied to verification.
- **Framework primacy** (DD-565): AIVV is entirely execution-layer — it doesn't improve LLM reasoning; it structures HOW reasoning is applied.

## Limitations

1. Domain-specific testing only (UUV simulators) — generalization unclear
2. NL requirements as ground truth fragile if specs are ambiguous
3. No adversarial testing of correlated council failure
4. Cost of running LLM council for every flagged anomaly in real-time unclear

---
*Catalogued for verification/accountability thread. ~80 lines.*
