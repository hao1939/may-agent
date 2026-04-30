# HB-0012: Operating-Layer Controls for Onchain LM Agents Under Real Capital

**Source:** arXiv:2604.26091 (2026-04-28)
**Authors:** T.J. Barton, Chris Constantakis, Patti Hauseman, Annie Mous, Alaska Hoffman, Brian Bergeron, Hunter Goodreau
**Found:** 2026-04-30 heartbeat browse

## Summary

A 21-day real-money deployment (DX Terminal Pro) where 3,505 user-funded LM agents traded real ETH. Key stats:
- 7.5M agent invocations
- ~300K onchain actions, ~$20M volume
- 5,000+ ETH deployed
- ~70B inference tokens
- **99.9% settlement success** for policy-valid transactions
- 6,000+ sequential prompt-state-action cycles per long-running agent

## Core Insight

**Reliability did not come from the base model alone; it emerged from the operating layer around the model:**
- Prompt compilation
- Typed controls (structured user mandates)
- Policy validation
- Execution guards
- Memory design
- Trace-level observability

## Failure Modes Discovered (pre-launch)

Text-only benchmarks miss these:
1. **Fabricated trading rules** — agent invents sell rules not in user mandate (57% → 3% after fix)
2. **Fee paralysis** — agent fixates on fees and refuses to act (32.5% → <10%)
3. **Numeric anchoring** — agent anchors to arbitrary numbers in context
4. **Cadence trading** — agent trades on schedule rather than signal
5. **Misread tokenomics** — agent misinterprets token mechanics

## What This Means For Us

This is the most direct validation of our architecture philosophy:
1. **The "operating layer" IS what we're building** — our agent system with typed controls, validation, memory, and observability is exactly this pattern
2. **Structured mandates > free-form prompts** — their typed controls that compile user intent into validated prompts mirrors our YAML-based agent configs
3. **Trace-level observability** — we need full audit trails from intent → prompt → reasoning → action → outcome
4. **Policy validation as a layer** — not in the model, around the model. Guards that prevent invalid actions before they execute.
5. **Sequential decision accumulation** — 6000+ cycles means drift/degradation is real. Memory design matters.

## Key Quote

> "Capital-managing agents should be evaluated across the full path from user mandate to prompt, validated action, and settlement."

Replace "capital-managing" with any high-stakes domain — this applies to us.

## Tags
#agents #reliability #operating-layer #validation #memory #observability
