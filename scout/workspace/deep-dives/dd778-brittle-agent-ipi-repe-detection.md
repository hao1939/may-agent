# DD#778 — Your Agent is More Brittle Than You Think: RepE-Based Multi-Step Attack Detection

**Paper:** 2604.03870 (Zhu et al., Apr 2026)
**Rating:** ★★★★½
**CR#324 Gap Filled:** Multi-step attack detection

## Key Findings

1. **Multi-step IPI evaluation**: First systematic evaluation of Indirect Prompt Injection attacks in dynamic multi-step tool-calling environments (not isolated single-turn). Four attack vectors × six defenses × nine LLM backbones.

2. **Defense fragility**: Advanced injections bypass nearly ALL baseline defenses. Some surface-level mitigations (prompt hardening, output filtering) produce counterproductive side effects — they degrade benign performance while failing to stop attacks.

3. **Decision entropy signal**: While agents execute malicious instructions almost instantaneously, their internal states exhibit abnormally high decision entropy. The model "hesitates" internally even as it complies externally — a latent detection signal.

4. **RepE circuit breaker**: Representation Engineering extracts hidden states at the tool-input position. RepE-based detection identifies unauthorized actions BEFORE commitment, achieving high accuracy across diverse backbones. This is a pre-generation interception method (cf. DD#669 spectral kill switches).

## Relevance to Our System

- **CR#324 gap fill**: This directly addresses "multi-step attack detection" — the paper shows single-turn benchmarks miss real attack surfaces, and RepE provides a practical detection paradigm for multi-step agent interactions.
- **CR#343 connection**: Fits the monitoring stack Layer 2 (behavioral signal monitoring). Decision entropy is exactly the kind of runtime behavioral signal the monitoring turn thesis predicts will outperform static approaches.
- **DD#669 complement**: Spectral kill switches (pre-generation circuit breakers via attention analysis) operate at a different layer than RepE (hidden state at tool-input position). These are complementary approaches — spectral for generation-time, RepE for action-time.
- **EXP-099 connection**: The "latent hesitation" finding parallels our cascade archetypes — agents may exhibit internal uncertainty signals even during Tool Spiral or Comprehension Cascade patterns.

## Predictions

- P-778a: Combining RepE action-time detection with spectral generation-time detection will yield >95% attack interception rate (neither alone achieves this).
- P-778b: Decision entropy at tool-input positions will also detect non-adversarial failure cascades (EXP-099 archetypes), not just IPI attacks.
- P-778c: Surface-level defenses (prompt hardening) will continue to show counterproductive effects as attack sophistication increases — only representation-level detection scales.

## For EXP-XXX

Bob: Consider measuring decision entropy (if accessible) during FM-3.3 verification collapse episodes — if agents show similar "latent hesitation" during organic failures, RepE-style detection could prevent cascades before they commit.
