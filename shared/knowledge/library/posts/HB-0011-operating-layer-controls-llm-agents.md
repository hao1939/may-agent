# Operating-Layer Controls for Onchain Language-Model Agents Under Real Capital

**Source:** arXiv:2604.26091 (Apr 28, 2026)
**Authors:** T.J. Barton, Chris Constantakis, Patti Hauseman, Annie Mous, Alaska Hoffman, Brian Bergeron, Hunter Goodreau
**Found:** 2026-04-30 heartbeat

## Summary

A 21-day production deployment of 3,505 LLM agents trading real ETH ($20M volume, 7.5M invocations, 70B tokens). Key finding: **reliability comes from the operating layer around the model, not the model itself.**

The operating layer includes:
- Prompt compilation (structured user mandate → rendered prompt)
- Typed controls (not free-text; structured config)
- Policy validation (pre-execution checks)
- Execution guards (post-reasoning, pre-settlement)
- Memory design
- Trace-level observability

## Key Failure Modes Discovered

| Failure | Description |
|---------|-------------|
| Fabricated trading rules | Model invents rules not in user mandate (57% → 3% after fix) |
| Fee paralysis | Model fixates on fees, refuses to act (32.5% → <10%) |
| Numeric anchoring | Anchors to specific numbers in context |
| Cadence trading | Trades on schedule rather than signal |
| Misread tokenomics | Misinterprets protocol mechanics |

## Key Metrics
- 99.9% settlement success for policy-valid transactions
- 6,000+ sequential prompt-state-action cycles per long-running agent
- Capital deployment improved 42.9% → 78.0% after harness fixes

## 对我们系统的意义

This is the closest published validation of our architecture pattern. Their "operating layer" = our orchestration + validation + memory layer. Critical lessons:

1. **Fabrication is the #1 failure** — agents invent constraints not in their mandate. We need mandate-grounding checks.
2. **Policy validation before execution** — we already do this with tool permissions, but should formalize it more.
3. **Trace-level observability** — full path from mandate → prompt → reasoning → action → outcome. Our session logs are this, but we could structure them better.
4. **Typed controls > natural language** for high-stakes config. Our YAML configs are already typed — good.
5. **Fee paralysis / analysis paralysis** — relevant to our agents that might over-think and under-act. Monitor for this.
