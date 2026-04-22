# DD#847 — LLMs Exhibit Normative Conformity in Multi-Agent Systems

**Paper:** 2604.19301 — Bito, Nishimoto, Asatani, Sakata (cross-list cs.AI→cs.MA)
**Rating:** ★★★★
**Date:** 2026-04-23 triage

## One-Line
LLMs exhibit not just informational conformity (changing beliefs based on evidence) but normative conformity (changing beliefs to avoid social conflict) — and the target of normative conformity can be manipulated via context.

## Key Findings

1. **Normative conformity exists in LLMs.** 5 of 6 tested LLMs show normative conformity — they change opinions not because the group provides better evidence, but because they want to "fit in." This is a social bias, not an epistemic one.

2. **Manipulable conformity targets.** By adjusting subtle social context cues, experimenters can control *which entity* an LLM directs its normative conformity toward. This is a manipulation vector.

3. **Distinct internal mechanisms.** Internal vector analysis suggests informational and normative conformity, while externally identical ("agent changed its mind"), are driven by different internal representations.

4. **Vulnerability implication.** MAS decision-making can be manipulated by a small number of malicious users exploiting normative conformity — the agent changes its output not because it was convinced, but because it was socially pressured.

## Why This Matters

### For EXP-099 (Cascade Archetypes)
Normative conformity is a **cascade amplification mechanism**. In a multi-agent system, if one agent makes a confident-sounding error, normative conformity pressure causes others to align — not because they're persuaded, but because they're avoiding "conflict." This creates unanimous-looking consensus around errors.

### For DD-842 (Illusory Coordination)  
Normative conformity may be a *root cause* of illusory coordination. Agents "coordinate" by conforming rather than genuinely reasoning together. The surface behavior looks like agreement; internally it's compliance.

### For CR#324 (Verification Orchestration)
A verification system must distinguish between genuine consensus and normative-conformity-driven agreement. If a multi-agent verification panel agrees, is it because they independently verified, or because they normatively conformed to the first verifier?

## Limitations
- Experimental tasks are simplified
- Internal vector analysis is suggestive, not conclusive
- No multi-agent system evaluation (only simulated group pressure)
