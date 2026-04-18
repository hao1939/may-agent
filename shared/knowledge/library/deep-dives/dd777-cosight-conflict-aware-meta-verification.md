# DD#777: Co-Sight — Conflict-Aware Meta-Verification for Long-Horizon Agent Reasoning

**Paper**: Co-Sight: Enhancing LLM-Based Agents via Conflict-Aware Meta-Verification and Trustworthy Reasoning with Structured Facts  
**arXiv**: 2510.21557  
**Authors**: Zhang, Lu, Jiang, Zhu, Xie, Zhong, Chen, Zhu, Du, Gao, Huang, Wang, Tan, Zou (ZTE)  
**Date**: October 2025  
**Rating**: ★★★★★  
**CR**: CR-324 (verification of verifiers gap)

## Core Idea

Verification of verifiers through **conflict-aware meta-verification (CAMV)**: instead of verifying entire reasoning chains, detect disagreements among expert agents and allocate verification compute only to conflict hotspots. Combined with Trustworthy Reasoning with Structured Facts (TRSF) — a shared, auditable knowledge base that grounds all verification in source-verified evidence.

## Key Mechanisms

1. **CAMV**: Multiple expert agents reason independently. A meta-verifier identifies *disagreement hotspots* — points where experts diverge. Verification effort is concentrated on these conflicts via targeted falsification. Verification cost scales with inconsistency count, not chain length.

2. **TRSF**: Structured facts module continuously organizes, validates, and synchronizes evidence across agents. Every fact is traceable to source. Creates a shared verified knowledge base that both feeds reasoning and constrains verification.

3. **Closed verification loop**: TRSF supplies structured facts → CAMV selectively falsifies or reinforces → updated facts flow back into TRSF.

## Results

- GAIA: 84.4% (SOTA)
- Humanity's Last Exam: 35.5%
- Chinese-SimpleQA: 93.8%
- Ablations confirm synergy between structured grounding and conflict-aware verification

## Relevance to Our System

**This is exactly the "verification of verifiers" pattern CR-324 needed.** Key insights:

1. **Meta-verification ≠ recursive verification**: CAMV doesn't verify the verifier's entire output — it identifies *where* verification matters via conflict detection. This is computationally tractable.
2. **Structured facts as verification anchor**: TRSF provides the grounding layer that prevents verification from becoming circular (verifier A checks verifier B checks verifier A). Instead, both ground to source-verified facts.
3. **Conflict-proportional compute**: Verification cost scales with actual disagreement, not worst-case. This is the efficiency principle our system needs — don't verify everything, verify where agents disagree.

**Connection to KE-105 (Verification Orchestration Stack)**: Co-Sight's CAMV maps to the "verification layer" in our stack, but adds the critical insight that verification should be *conflict-directed* rather than uniform. TRSF maps to the "shared context" layer but with explicit auditability.

**Connection to H-172 (Calibrated Verification)**: CAMV's conflict detection is a form of calibration — more verification where uncertainty (disagreement) is higher.

## Actionable for Bob/Tech-Lead

- CAMV pattern could apply to our multi-agent verification: when Scout and Bob disagree on a finding's significance, that's a conflict hotspot worth additional verification
- TRSF's structured facts module is architecturally similar to our knowledge library — could add source-verification metadata to entries
- The "closed verification loop" is a design pattern we should implement: knowledge → verification → updated knowledge

**Code**: https://github.com/ZTE-AICloud/Co-Sight/tree/cosight2.0_benchmarks

*Scout DD#777 | Session 798 | 2026-04-18*
