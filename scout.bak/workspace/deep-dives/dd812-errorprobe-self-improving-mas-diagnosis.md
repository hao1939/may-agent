# DD#812 — ErrorProbe: Self-Improving Error Diagnosis in Multi-Agent Systems

**Paper**: "Towards Self-Improving Error Diagnosis in Multi-Agent Systems"
**Authors**: Li, Yilmaz, Chen, Le
**ArXiv**: 2604.17658 | **Venue**: ACL 2026 Findings
**Topics**: multi-agent debugging, failure attribution, episodic memory, verification

## Problem

LLM-based multi-agent systems produce long interaction traces with inter-agent dependencies and delayed error manifestation. Existing diagnostics rely on expensive expert annotation or "LLM-as-a-judge" which struggles to pinpoint the decisive error step in extended contexts.

## Method: ErrorProbe

Three-stage self-improving pipeline:

1. **Failure taxonomy operationalization** — detects local anomalies by classifying MAS failure modes
2. **Symptom-driven backward tracing** — prunes irrelevant context by tracing backward from observed failure symptoms
3. **Multi-agent validation team** — Strategist, Investigator, Arbiter validate error hypotheses through tool-grounded execution

Key innovation: **Verified episodic memory** that updates only when error patterns are confirmed by executable evidence. No annotation needed. Enables cross-domain transfer without retraining.

## Results

Evaluated on TracerTraj and Who&When benchmarks. Significantly outperforms baselines on step-level localization. Verified memory enables robust cross-domain transfer.

## Scout Analysis

### Why This Matters

This is the **verification/testing** angle our coverage tracks. ErrorProbe addresses a critical gap: when multi-agent systems fail, *which agent* failed and *at which step*? The backward-tracing + executable-evidence approach is more rigorous than pure LLM-as-judge.

### Connections to Prior Work

- **DD#782 (HORIZON)**: Both tackle long-horizon failure diagnosis. HORIZON focused on single-agent long-horizon tasks; ErrorProbe targets multi-agent interaction traces specifically.
- **DD#811 (Artificial Organisations)**: Both study information asymmetry in MAS. ErrorProbe's insight that errors propagate through inter-agent dependencies connects to organizational information flow.
- **CR#346 macro-thread on verification**: Extends the verification pipeline from static checking to runtime diagnosis with self-improving memory.

### Key Insight

The separation of *rejection* (catching the error) from *recovery* (fixing after acceptance) as independent capabilities echoes AgentProp-Bench's finding (DD#814). Error diagnosis is fundamentally different from error correction — you need distinct mechanisms for each.

### Limitations

- Relies on tool-grounded execution for validation — what if the tools themselves are unreliable?
- The multi-agent diagnostic team (Strategist/Investigator/Arbiter) introduces its own coordination overhead

**Rating**: ★★★★½
