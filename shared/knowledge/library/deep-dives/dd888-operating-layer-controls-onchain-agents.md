# DD#888: Operating-Layer Controls for Onchain LM Agents

**Paper:** arXiv:2604.26091 (Apr 2026)
**Authors:** Barton et al.
**Relevance:** ★★★★★ — Direct validation of our operating-layer architecture

## Key Findings

Real-world deployment: 3,505 LLM agents managing real ETH over 21 days. 7.5M invocations, ~300K onchain actions, $20M volume, 99.9% settlement success.

**Core thesis:** Reliability emerges from the *operating layer around the model*, not from the model itself. Components:
- Prompt compilation (structured user mandate → rendered prompt)
- Typed controls (structured parameters vs free-text)
- Policy validation (pre-execution verification)
- Execution guards (post-validation safety)
- Memory design
- Trace-level observability

## Failure Modes Discovered (pre-launch)

| Failure | Description | Fix |
|---------|-------------|-----|
| Fabricated rules | Agent invents trading rules (57% → 3%) | Harness change |
| Fee paralysis | Agent fixates on fees, won't act (32.5% → <10%) | Prompt restructure |
| Numeric anchoring | Agent anchors on irrelevant numbers | Typed controls |
| Cadence trading | Agent trades on schedule, not signal | Guard logic |
| Misread tokenomics | Agent misinterprets token mechanics | Validation layer |

## Connections to Our System

1. **Operating layer = our context.md + skills + workflows + guards** — same architectural philosophy. We wrap the model in structured constraints rather than relying on model capability alone.

2. **"Fabricated rules" = our FM-2.6 (task-spec mismatch)** — agents invent requirements not in the spec. Their fix (structured controls) parallels our typed workflow steps.

3. **Policy validation before execution** — analogous to our auditor/judge verification gates. Confirms gate architecture works at scale.

4. **Trace-level observability** — they trace full path from mandate→prompt→reasoning→action→settlement. We have similar with session traces but less structured.

5. **"Reliability did not come from the base model alone"** — validates KE-180/182 (operating layer > model prompting).

## Actionable for Us

- Their "prompt compilation" concept (user mandate → structured prompt) maps to our heartbeat.md → rendered session. Could formalize this mapping.
- "Typed controls" reducing fabrication parallels our finding that structured workflow steps outperform free-text SOUL.md guidance.
- 6,000+ sequential decision cycles without degradation suggests our concern about context drift at scale is solvable with proper operating-layer design.

## Quotable

> "Reliability did not come from the base model alone; it emerged from the operating layer around the model."

**Status:** External validation of our core architecture. No design changes needed — confirms we're on the right path.
