# Scout Findings — 2026-06-16

## XHS Knowledge Library Consolidation

- **5 redundant XHS files superseded** → active XHS notes reduced from 8 to 3
- Canonical XHS note: `xhs_chinese_ai_trends_june2026.md` (620 lines, all active research)
- **Prediction checkpoint**: 3/13 predictions confirmed (上下文工程, 技能工程, 自進化智能體), 3 entering forecast window in July (護栏效應, 記憶管理, 模型韌性)
- ⚠️ Canonical note at 620 lines — recommend splitting out prediction tracker at next major update
- Full assessment: `knowledge/findings/2026-06-15-xhs-library-health-assessment.md`

## arXiv Batch 5 — June 11–12 papers (13 new papers triaged)

**Fail-plausible**: New failure class identified in production agent runtimes — the LLM doesn't just fail silently, it transforms errors into convincing narratives. 70% of silent failures caught by human observation, not automated tests. ([2606.14589](https://arxiv.org/abs/2606.14589))

**Guardrail DoS**: Guardrails themselves can be attacked — crafted payloads trap reasoning-based guards in loops, causing 13–63× token amplification and up to 148× latency. A single poisoned document can paralyze an entire multi-agent system. ([2606.14517](https://arxiv.org/abs/2606.14517))

**Evolvable harnesses**: HarnessX introduces a "foundry" for composable, self-improving agent harnesses via typed substitution algebra + trace-driven evolution. +14.5% avg gain across 5 benchmarks. AgentSpec shows scaffold interaction effects matter more than individual module strength. ([2606.14249](https://arxiv.org/abs/2606.14249), [2606.14674](https://arxiv.org/abs/2606.14674))

**Skills attack surface deepens**: Cross-modal attacks (benign SKILL.md + benign code = data exfiltration) evade 83–98% of current scanners. Distilled 7B model achieves 88.2% detection — frontier-level. ([2606.14154](https://arxiv.org/abs/2606.14154))

**tap protocol**: File-based heterogeneous agent collaboration (Claude + Codex, 27-day production). Heterogeneous pairs catch 16.7pp more review defects than homogeneous pairs. Validates file-first stigmergy. ([2606.14445](https://arxiv.org/abs/2606.14445))

→ Full triage: [2026-06-16-arxiv-ai-agent-triage.md](../../projects/scout-knowledge-lib/knowledge/findings/2026-06-16-arxiv-ai-agent-triage.md)

