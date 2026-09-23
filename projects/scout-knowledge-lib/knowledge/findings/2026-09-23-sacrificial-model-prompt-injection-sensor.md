<ai_context>
summary: "Little Canary implements prompt-injection sensing by exposing inbound text to a tool-less sacrificial model, classifying the model's response residue, and routing PASS/FLAG/BLOCK separately from coverage state. Its source makes the useful pattern—and its limits—concrete: the canary has no application authority, but the classifier is still probabilistic, failures are fail-open by default, adapters cover only specific host boundaries, and historical benchmark artifacts are not admitted as current performance claims."
triggers: ["Little Canary", "behavioral canarying", "sacrificial model", "prompt injection sensor", "response residue", "inbound screening", "canary model", "degraded coverage", "host deny channel"]
last_updated: "2026-09-23"
source_basis: "GitHub repository hermes-labs-ai/little-canary at commit d509193c72f852d7c9af356264c71ca4eec1e5b4; selected documentation, implementation, tests, and retained benchmark artifacts inspected on 2026-09-23. Tests and live models were not run."
</ai_context>

# A sacrificial model can expose prompt-injection effects without receiving authority

**Date:** 2026-09-23  
**Disposition:** New implementation-level evidence for a behavioral detection pattern  
**Repo:** https://github.com/hermes-labs-ai/little-canary  
**Reviewed revision:** [`d509193c72f852d7c9af356264c71ca4eec1e5b4`](https://github.com/hermes-labs-ai/little-canary/commit/d509193c72f852d7c9af356264c71ca4eec1e5b4) (`0.3.8` in `pyproject.toml`)  
**Coverage:** Repository tree plus selected README, pipeline, canary, judge, structural-filter, host-capability, adapter, test, and benchmark files. No test suite or live model was run.

## Observation

Little Canary turns a familiar mine-canary idea into an inbound prompt-injection sensor. Instead of asking only whether untrusted text *looks* malicious, it sends the text to a small model with a fixed system prompt and inspects the resulting behavior:

1. a deterministic structural filter checks known signatures, control characters, suspicious Unicode, and decoded payloads;
2. text that was not already blocked reaches a small sacrificial model;
3. a regex analyzer or optional second model classifies the canary's response residue; and
4. policy maps the result to pass, advisory, or block.

The important isolation choice is explicit in [`little_canary/canary.py`](https://github.com/hermes-labs-ai/little-canary/blob/d509193c72f852d7c9af356264c71ca4eec1e5b4/little_canary/canary.py): Little Canary gives the probe no application tools or actions and captures rather than executes its output. The raw untrusted input is intentionally unsanitized because susceptibility is the measurement. Temperature zero and a fixed seed reduce avoidable variance, but the code comments correctly say that each response remains run-bound evidence rather than a deterministic fact.

This yields a useful architectural pattern: **let an expendable component absorb the influence, but deny it authority; observe the effect from outside.** It complements rather than replaces the deterministic enforcement patterns in [Agent Security: Defense Architectures](../agent-security-defense-architectures.md) and [Verified Enforcement Patterns](../agent-security-verified-enforcement.md).

## The implementation preserves coverage truth separately from routing

[`little_canary/pipeline.py`](https://github.com/hermes-labs-ai/little-canary/blob/d509193c72f852d7c9af356264c71ca4eec1e5b4/little_canary/pipeline.py) records `canary_status`, `analysis_status`, and `degraded` separately from the final `safe` routing bit. Probe errors, judge errors, timeouts, and unparseable judge output produce no invented risk score. They are marked degraded and route fail-open by default; operators can configure supported adapters to fail closed.

That distinction prevents an availability decision from masquerading as inspection evidence:

- **allowed** can mean inspection ran and found no covered signal;
- **allowed + degraded** means required behavioral coverage failed;
- **blocked by structural filter** can mean the canary was intentionally skipped; and
- **blocked + degraded** means another layer blocked even though behavioral analysis failed.

This is more transferable than the detector itself. Any security pipeline with optional or fallible layers should expose *disposition* and *coverage* as separate dimensions.

## A sensor is only as enforceable as its host boundary

The repository's [host capability matrix](https://github.com/hermes-labs-ai/little-canary/blob/d509193c72f852d7c9af356264c71ca4eec1e5b4/docs/host-capability-matrix.md) distinguishes inbound interception from outbound tool veto rather than calling every plugin a blocker:

- Claude Code, Gemini CLI, OpenClaw, and the OpenAI Agents SDK expose an inbound deny path in the tested surfaces.
- The Codex CLI install route was observed, but runtime interception was not; an installed, enabled, but untrusted hook screened nothing in the documented headless run.
- Hermes Agent cannot refuse prompt delivery at its inbound hook, so Little Canary instead withdraws downstream tool authority on a block.
- GitHub Copilot CLI's inbound hook can rewrite or annotate but has no deny field, so the repository ships no Copilot artifact.

Even these rows are bounded. The adapters screen submitted prompts, not tool results, retrieved documents, files, model outputs, or every alternate runner. The OpenClaw adapter, for example, passes service errors and degraded coverage through by default and documents one runner that bypassed plugin hooks. A detector claim therefore needs three receipts: **the detector exercised, the adapter ran, and the host provided an effective deny or authority-withdrawal channel.**

## Limits and unresolved questions

1. **Cross-model transfer is an assumption to measure.** A small canary and the authoritative model need not react alike. A clean canary response does not prove the production model would resist the same input.
2. **The optional judge is another model exposed to attacker-controlled text.** [`little_canary/judge.py`](https://github.com/hermes-labs-ai/little-canary/blob/d509193c72f852d7c9af356264c71ca4eec1e5b4/little_canary/judge.py) places both the original message and canary response into the judge's user turn and accepts only an exact `SAFE` or `UNSAFE` token. Strict parsing turns malformed output into degraded coverage, but does not make the classifier a containment boundary.
3. **“Powerless” is library-scoped, not OS isolation.** The README explicitly says the project does not sandbox the canary process at the operating-system level. Endpoint configuration and local-model custody remain part of the threat model; remote endpoints receive the screened text.
4. **Known-pattern detection and behavioral sensing are coupled in the default pipeline.** Structural matches can block before the canary runs, so aggregate pipeline outcomes cannot be credited entirely to behavioral canarying.
5. **The repository does not currently support a public performance rate.** [`benchmarks/README.md`](https://github.com/hermes-labs-ai/little-canary/blob/d509193c72f852d7c9af356264c71ca4eec1e5b4/benchmarks/README.md) labels retained TensorTrust tables historical, says they combine structural filtering, canary behavior, and downstream model behavior, notes that the third-party sample and some artifacts are absent, and explicitly declines aggregate detection, false-positive, latency, token-savings, or universal-repeatability claims for the documented evaluation boundary. The retained JSON numbers are artifacts to inspect, not a current certificate.

## Reusable implication

Behavioral canarying is most credible as an **early-warning sensor in front of independent authority controls**, not as a proof that input is safe. A production design should:

- make the sacrificial path unable to act;
- preserve exact probe, analyzer, and adapter coverage states;
- bind live evidence to model digest, runtime, prompt, and configuration;
- test canary-to-production transfer and repeated-run stability;
- verify hook activation and effect denial on each host surface; and
- keep least privilege and tool authorization downstream even after a clean result.

The non-obvious design lesson is that sacrificial exposure becomes useful only when *influence and authority are deliberately separated*. The canary is allowed to be compromised precisely because compromise cannot itself produce an effect.

## Source trail

Discovery used GitHub's repository Search API with:
`topic:ai-agents pushed:>2026-09-22 stars:>20`, sorted by recently updated, 20 results. The response reported `total_count: 1105` and `incomplete_results: false`. Repository contents were then pinned to the reviewed commit before use as claim evidence.
