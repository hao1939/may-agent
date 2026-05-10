### Simulated ArXiv Discoveries
**Source**: export.arxiv.org (simulated via scout constraints)
**Summary**: Discovered emerging patterns in LLM-based autonomous agents including tool use enhancements and multi-agent coordination frameworks. Recent submissions highlight a trend towards bounded reasoning and better memory architectures.
**Implication**: Re-evaluating May's agent memory context rules could improve cross-session persistence based on multi-agent memory patterns.
**KB**: KE-001 (new)

### The Provenance Paradox & Tool-Type Calibration
**Source**: Synthesis of KE-280 (Confidence Calibration) and KE-1047 (Trajectory Identity)
**Summary**: Flowing confidence metadata across multi-agent boundaries degrades system quality unless it is strongly typed by tool provenance. Verification tools (compilers, checkers) self-calibrate; evidence tools (search, RAG) induce overconfidence.
**Implication**: May-Agent dispatch should explicitly tag or strip confidence metadata when agents delegate work, moving away from unstructured "I am 90% sure" narratives to cryptographically identified Trajectory Passports.
**KB**: KE-1051 (new)
