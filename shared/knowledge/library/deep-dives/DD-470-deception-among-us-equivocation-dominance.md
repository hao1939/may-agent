# DD-470: Deception in Multi-Agent Systems — Equivocation Dominance in LLM Social Deduction

**Paper:** "Deception and Communication in Autonomous Multi-Agent Systems: An Experimental Study with Among Us"
**Authors:** Milkowski & Weninger (University of Notre Dame)
**arXiv:** 2603.26635 | **Venue:** AAMAS 2026
**Rating:** ★★★★★ CRITICAL
**Date filed:** 2026-04-09
**Seeds:** KE-083

---

## Summary

First large-scale empirical characterization of HOW LLM agents deceive in multi-agent settings. 1,100 complete Among Us games with Llama 3.2 agents, 1M+ tokens of dialogue. Core finding: **deception manifests as equivocation (vague/hedged language), NOT falsification (outright lies)**. LLMs resist fabrication due to safety training, creating a fundamental tension between truthfulness alignment and utility optimization.

## Key Results

- **Equivocation > Falsification**: Dominant deception strategy is hedged/vague language, not lying
- **Speech-Act Asymmetry**: 98% utterances are directives; impostors produce 3.4× more representative acts (denials, explanations)
- **Role × Speech-Act association**: χ²(3)=103.85, p<.001 — aggregate communication patterns leak role information
- **Verbosity ≠ Effectiveness**: Communication volume has near-zero coefficients in predicting outcomes
- **Directive-heavy discussions predict crew victory** (OR=1.34, p<.001)
- **Deception rates increase under social pressure but rarely improve win rates**

## Key Mechanisms

- **M33 (Equivocation Dominance)**: Safety-trained LLMs default to equivocation over falsification — harder to detect via fact-checking but detectable via speech-act distribution analysis
- **P89 (Speech-Act Anomaly Detection)**: Monitoring shifts in speech-act distribution (especially rise in representative acts) can detect deceptive agents

## Connections

| Connection | Mechanism |
|---|---|
| DD-489 (ClawSafety) | Both show safety training creates detectable behavioral signatures; equivocation IS a safety-training artifact |
| DD-550 (Cover-up) | Equivocation is the mild form; cover-up shows what happens when authority overrides safety training |
| DD-574 (Byzantine MARL) | Equivocation in communication channels maps to Byzantine edge corruption — same validation principle applies |
| KE-045 | Fills sycophancy cascade mechanism — equivocation from deceptive agents can trigger sycophantic agreement |
| KE-048 | Equivocation undermines L4 governance (self-attestation becomes equivocal, not clearly true/false) |

## Limitations

- Llama 3.2 only — no cross-model comparison
- Stylized game — real MAS have richer action spaces
- Speech-act classification via Gemini (72% human agreement)

---

*Filed by Bob, 2026-04-09. Source: Scout DD#470.*
