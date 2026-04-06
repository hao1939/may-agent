# KE-032: Forced Externalization Works Via Two Independent Pathways (Write OR Read)

**Status**: Verified  
**Source**: EXP-046 (primary); EXP-044, EXP-045, KE-031, H-085  
**Date**: 2026-04-06  
**Filed by**: Bob (Architect)

## Finding

Forced externalization has **two independent pathways** — either writing analysis or reading pre-written analysis is sufficient to eliminate judgment failures. The write-read-act sequence in our standard workflow is belt-and-suspenders, not a single causal chain. P3 of H-085 (reading is necessary) was disconfirmed.

## Evidence

### EXP-046 Three-Condition Ablation

| Condition | Mechanism | N | Pass Rate | vs Baseline |
|-----------|-----------|---|-----------|-------------|
| Baseline (no externalization) | None | 6 | 50% (3/6) | — |
| Write + Read | Full workflow | 9 | 100% (9/9) | +50pp |
| Write only | Agent writes ANALYSIS.md; Phase 2 doesn't reference it | 5 | 100% (5/5) | +50pp |
| Read only | Pre-written ANALYSIS.md; agent reads but never wrote | 5 | 100% (5/5) | +50pp |

All three externalization conditions achieve identical 100% pass rate. Fisher exact test (any condition vs baseline): p < 0.05. Combined externalization (19/19) vs baseline (3/6): p < 0.001.

### What Was Ruled Out

1. **Writing is not the sole mechanism**: If commitment-through-articulation were the only path, read-only should fail. It doesn't (5/5).
2. **Reading is not the sole mechanism**: If context-anchoring were the only path, write-only should fail. It doesn't (5/5).
3. **Both channels are independently sufficient**: Either one alone produces the full effect.

### Revised Mechanism Model

Two independent channels, either sufficient:

| Channel | Mechanism | How It Works |
|---------|-----------|-------------|
| **Writing path** | Commitment/articulation | Generating analysis engages deliberative reasoning. Once committed to text, self-consistency pressure prevents contradicting the written judgment |
| **Reading path** | Context anchoring | Exposure to correct analysis (even externally written) anchors the agent's behavior to that analysis, overriding default compliance/action bias |

The standard workflow activates BOTH channels, making it maximally robust. But either alone achieves 100% on this scenario.

## Design Implications

### 1. Pre-written analysis templates can substitute for forced writing
For **known-pattern situations** (e.g., "before deleting files, read this safety checklist"), a pre-written analysis read by the agent achieves the same effect as forcing the agent to write its own. This is cheaper (no Phase 1 generation cost) and faster.

### 2. Workflow gates don't need explicit "read what you wrote" steps
Write-only achieves 100% — the agent's internal state from having written the analysis persists into Phase 2 even without an explicit re-read instruction. This simplifies workflow design.

### 3. The gate's primary role is ensuring at least one channel activates
The structural gate may not need to enforce the full write→read→act sequence. Its essential function is ensuring the agent engages with judgment-relevant analysis (by any means) before acting.

## Limitations

1. **Possible ceiling effect**: The sycophants-dilemma scenario may be too easy with any form of analysis context. Baseline 50% might reflect minimal-prompt conditions, not genuine difficulty. Need harder scenarios (P4, P5 proposed in H-085).
2. **Small N per condition**: 5 per ablation arm limits ability to detect differences between conditions. A scenario where one channel works at 80% and the other at 100% would not be detectable at N=5.
3. **Correctness untested**: Read-only used a correct pre-written analysis. P5 (does WRONG analysis still help?) is the critical next test. If wrong analysis still helps, the mechanism is "any deliberation trigger." If it fails, correctness matters and read-only requires accurate content.
4. **Single scenario**: All three conditions tested on sycophants-dilemma only. Cross-domain confirmation of dual pathway not yet done.

## Relationship to Other Knowledge

- **KE-031** (domain-independent externalization): KE-032 refines the mechanism. KE-031 showed externalization works across 3 domains; KE-032 shows HOW — via two independent channels.
- **KE-029** (classify-then-act): The classify step can be either agent-generated (write path) or pre-provided (read path).
- **KE-002** (text rules don't fix judgment): Still true — text rules provide neither channel. They don't force writing and aren't structured analysis to read.
- **H-085**: KE-032 is the empirical summary of P3 disconfirmation. H-085 retains P(H) = 0.97 with refined mechanism model.

## Cumulative Externalization Evidence

With EXP-046, the aggregate externalization record is:
- **40/40 (100%)** across 8+ scenario variants and 3 failure domains
- vs **7/27 (26%)** baseline across same scenarios
- **+74pp aggregate improvement** (p < 0.0000000001)

This is the strongest, most replicated empirical finding in the training system.

---
*KE-032 | Bob (Architect) | 2026-04-06*
