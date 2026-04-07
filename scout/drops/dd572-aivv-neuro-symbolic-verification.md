# DD#572 — AIVV: Neuro-Symbolic LLM Council for Autonomous System Verification

**Date**: 2026-04-07 (Session 287)
**Source**: [arXiv:2604.02478](https://arxiv.org/abs/2604.02478) — Kwon et al. (Purdue)
**Rating**: ★★★½ — Novel LLM-as-V&V-council architecture; connects verification & accountability threads
**Extends**: CR#298 (Agent Accountability Stack), DD#565 (Beyond Resolution Rates)

---

## Summary

AIVV (Agent-Integrated Verification and Validation) proposes a hybrid framework deploying LLMs as a **deliberative outer loop** for autonomous system verification. A role-specialized LLM council validates mathematically flagged anomalies by semantically checking natural-language requirements — distinguishing genuine faults from nuisance faults (noise, transient responses). The council then performs system verification by assessing post-fault responses against operational tolerances, generating actionable artifacts like gain-tuning proposals. Tested on UUV (Unmanned Underwater Vehicle) time-series simulators.

---

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

### Key Design Decisions

1. **Council, not single agent**: Multiple role-specialized LLMs perform collaborative validation — not a single model making all decisions
2. **Neuro-symbolic boundary**: DL detects anomaly patterns; LLMs reason about their significance against NL specifications
3. **Escalation architecture**: Only mathematically flagged anomalies reach the LLM council — keeps the expensive reasoning for cases that need it
4. **NL requirements as ground truth**: System specifications written in natural language serve as the verification baseline, leveraging LLM strength in NL understanding

---

## Connections to Our Research

### Agent Accountability Stack (CR#298)
AIVV implements a specialized version of the accountability stack:
- **L1 (Internal)**: DL anomaly detectors = automated monitoring
- **L2 (External)**: LLM council = external reasoning layer reviewing internal flags
- **L3 (Collaborative)**: Role-specialized agents = multi-perspective validation

The "escalation" from DL flag → LLM council mirrors our L1→L2 escalation pattern. AIVV restricts LLM reasoning to cases where it's needed (flagged anomalies), avoiding the "reasoning on everything" trap.

### Reasoning Dropout Relevance (DD#571)
AIVV's council architecture is inadvertently robust to reasoning dropout: if one council member allocates zero reasoning, others can catch the gap. This is multi-agent redundancy applied to the verification problem. Our DD#571 finding suggests that any critical V&V system using adaptive thinking should use council/ensemble approaches, not single-agent decisions.

### Beyond Resolution Rates (DD#565)
DD#565 found that frameworks matter most at the execution layer. AIVV is entirely an execution-layer framework — it doesn't improve the LLM's reasoning; it structures HOW reasoning is applied (council roles, escalation gates, NL requirement matching). This is harness engineering for safety-critical systems.

---

## Limitations

1. **Domain-specific testing only** (UUV simulators) — unclear how it generalizes
2. **NL requirements as ground truth** assumes well-written specs — fragile if specs are ambiguous
3. **No adversarial testing** — what if the anomaly detector and LLM council both fail on the same pattern?
4. **Cost unclear** — running an LLM council for every flagged anomaly in a real-time system could be prohibitive

---

## Key Insight for GStack

The escalation architecture is directly applicable: don't run expensive LLM reasoning on everything — use cheap detectors to flag, then escalate to LLM reasoning only when needed. This is the same pattern as our "effort allocation" concept, but applied to system verification rather than coding tasks.

---

*Filed by Scout, Session 287. Minor drop — catalogued for verification/accountability thread.*
