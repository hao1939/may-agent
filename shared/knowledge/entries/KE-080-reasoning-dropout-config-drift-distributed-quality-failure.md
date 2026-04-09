# KE-080: Reasoning Dropout and Configuration Drift — Distributed Quality Failure in Adaptive Agent Systems

**Status**: Empirically Confirmed (first-party Anthropic disclosure + independent reproductions)
**Confidence**: Very High — Official team confirmation of zero-reasoning mechanism (DD-571), 809+ HN points (DD-583)
**Date**: 2026-04-09
**Sources**: DD-571 (Adaptive Thinking Zero-Reasoning Hallucination, ★★★★★ LANDMARK), DD-583 (Sub-Agent Configuration Drift, ★★★★★)
**Filed by**: Bob

---

## The Core Finding

Two related disclosures from the Claude Code team reveal that the reasoning depth crisis (KE-046) has a deeper, distributed nature:

> **Reasoning quality failure is not just a single-agent depth problem — it's a distributed systems problem. Adaptive thinking can eliminate reasoning entirely on specific turns (reasoning dropout), and critical configuration doesn't propagate to spawned sub-agents (config drift). Together, these create intermittent, invisible, cascading quality failures that are structurally undetectable without per-turn instrumentation.**

This extends KE-046's causal model from "thinking budget reduction" to two distinct but interacting failure modes.

---

## Failure Mode 1: Reasoning Dropout (DD-571)

### The Mechanism

Boris (Claude Code team) analyzed five user-submitted session transcripts and made a landmark disclosure:

> "your sessions were sending effort=high on every request (confirmed in telemetry), so this isn't the effort default. The data points at adaptive thinking under-allocating reasoning on certain turns — the specific turns where it fabricated (stripe API version, git SHA suffix, apt package list) had zero reasoning emitted, while the turns with deep reasoning were correct."

**Key shift from KE-046**: KE-046 documented *reduced* reasoning depth (2,200 → 560 chars, -75%). DD-571 reveals *eliminated* reasoning — zero tokens on specific turns, even with effort=high. This is qualitatively different: not a gradient of degradation but a binary dropout.

### The Confidence-Difficulty Inverse

The fabricated content was precisely the kind that *seems easy*:
- Stripe API version → familiar pattern, generates plausible version string
- Git SHA suffix → familiar hex pattern, generates plausible hash
- apt package list → familiar format, generates plausible names

**Principle**: Adaptive thinking allocates MORE reasoning to perceived-hard turns and LESS (or zero) to perceived-easy turns. But "perceived difficulty" correlates with pattern novelty, not factual accuracy requirements. Familiar-looking tasks get zero reasoning because they're easy to pattern-match — but pattern matching fabricates when specific details differ from training data.

This is the **Dunning-Kruger Effect for LLMs**: the model is most confident (allocates least reasoning) precisely on the tasks where it's most likely to fabricate.

### Interaction with Inspectability

The three mechanisms multiply:
1. **Adaptive thinking** creates zero-reasoning turns (intermittent)
2. **Thinking redaction** hides which turns had zero reasoning (invisible)
3. **Lower default effort** increases dropout frequency (amplified)

Result: **steganographic hallucination** — fabricated outputs hidden inside normal operational variation.

---

## Failure Mode 2: Configuration Drift (DD-583)

### Sub-Agent Effort Non-Propagation

`CLAUDE_CODE_EFFORT_LEVEL=max` is NOT inherited by sub-agents. The parent runs at max effort; sub-agents revert to default (85% or lower). Since sub-agents handle the critical path (file reads, writes, test runs), this creates:

**Correct diagnosis, wrong fix** — the orchestrator thinks deeply enough to identify the bug, but the execution sub-agent cuts corners on the implementation.

### Thinking Token Leakage

Extended thinking tokens appearing inside code patches — reasoning fragments embedded in source files. The thinking/output boundary is not architecturally enforced but conventionally maintained, and conventions break under the redaction header interaction.

### Configuration Entropy (Quantified)

**8+ configuration surfaces** affect reasoning quality:
1. `CLAUDE_CODE_EFFORT_LEVEL` env var (parent only)
2. `settings.json` → `showThinkingSummaries`
3. `settings.json` → managed settings scope (Teams/Enterprise)
4. `.claude.json` project config
5. `/compact` and `/clear` slash commands
6. Magic keywords in prompts
7. Sub-agent default effort (not configurable)
8. API-level `redact-thinking-2026-02-12` header

No unified model, no way to verify effective configuration of a running session. O(N!) misconfiguration probability.

---

## Synthesis: The Distributed Quality Failure Pattern

### Updated Causal Model (extending KE-046)

```
KE-046 Model:                  KE-080 Extended Model:
Single agent, depth gradient    Multi-agent, binary dropout + config drift

  reduced thinking                adaptive thinking
  ↓ less research                 ↓ ZERO reasoning on "easy" turns
  ↓ more errors                   ↓ HALLUCINATION (intermittent, invisible)
  ↓ more retries                  
  ↓ 15-20× cost                 sub-agent config drift
                                  ↓ parent thinks deep, child thinks shallow
                                  ↓ correct diagnosis + wrong implementation
                                  
                                 thinking token leakage
                                  ↓ reasoning fragments in code output
                                  ↓ category error in output boundary
```

The three new failure modes are *orthogonal* — any combination can occur:
- Dropout alone = single turn fabricates
- Config drift alone = orchestrator correct, executor incorrect
- Leakage alone = output contaminated with reasoning fragments
- Dropout + drift = parent fabricates context, child executes on fabrication with reduced effort
- All three = **hallucination amplification cascade**: fabricated parent output → inherited by drifted sub-agent → reasoning leaks into code → downstream systems execute contaminated code

---

## Connection to Our FM-3.3 Verification Failures

Our #1 failure mode (FM-3.3, 20.3% of all errors per EXP-099) is verification failure — claiming success without verifying outputs. DD-571's reasoning dropout provides a potential mechanism:

1. **Verification feels "easy"** — the agent has just completed the task, checking feels routine
2. **Adaptive thinking allocates less reasoning to verification turns** — the check is pattern-matched as trivial
3. **Zero-reasoning verification = confident but unchecked claim** — exactly FM-3.3

**Hypothesis**: FM-3.3 may be partially driven by the same overconfidence-on-familiarity mechanism that causes reasoning dropout. The agent "knows" it should verify, pattern-matches "everything looks fine," and emits a success claim without actually checking — because the verification step received zero (or near-zero) reasoning allocation.

This doesn't explain all FM-3.3 (our structural interventions like forced externalization work, suggesting the failure is addressable), but it may explain why FM-3.3 is so persistent and recurrent — it's reinforced by the model's reasoning allocation bias.

---

## Connection to Positional Privilege (H-091)

DD-571's "Dunning-Kruger for LLMs" has an interesting parallel with H-091 (positional privilege):

- **H-091**: Information placement determines attention — task-message gets recency attention, system-prompt gets primacy (decaying)
- **DD-571**: Perceived difficulty determines reasoning allocation — familiar patterns get zero reasoning, novel patterns get deep reasoning

Both are **attention allocation mechanisms** — one spatial (where in the context), one computational (how much reasoning). Both create failures through *misallocation* rather than *absence*: the model has the capability but directs it to the wrong place/task.

**Implication**: Just as H-091 shows we must place critical info in the task message (recency zone), DD-571 suggests we must make critical verification steps *appear novel/hard* rather than routine — otherwise reasoning dropout will skip them.

---

## Should We Add Config Drift Monitoring?

DD-583's configuration entropy problem maps directly to our system:

### What We Already Do
- All agent outputs are written to files (inspectable)
- Extended thinking is used (not reduced)
- Forced externalization (KE-043) structurally activates analysis

### Gaps Identified
1. **No per-session configuration audit** — we don't log effective config at session start
2. **Sub-agent delegation doesn't verify config inheritance** — when Master → Coach → Coder, each layer may have different effective settings
3. **No Read:Edit ratio monitoring** — DD-541/KE-046's strongest leading indicator, still uninstrumented
4. **No reasoning depth tracking** — no historical data to detect drift over time

### Recommendations
1. **R93 adoption**: Enforce a minimum reasoning floor — never allow zero reasoning on turns involving factual claims or verification (directly addresses FM-3.3 mechanism hypothesis)
2. **R84 adoption**: Critical configuration must propagate down the agent tree by default
3. **Configuration state logging**: Log effective configuration at session start for audit trail
4. **Read:Edit ratio as health metric**: Instrument and alert on R:E < 3.0 (KE-046 threshold)

---

## The Reasoning Floor Principle (Law 46, from DD-571)

> In adaptive reasoning systems, the minimum reasoning allocation MUST be non-zero for any turn involving factual claims, code generation, or system-state modifications. The model's self-assessment of reasoning need exhibits systematic overconfidence on familiar-seeming tasks, creating an inverse correlation between perceived difficulty and actual fabrication risk.

This is the infrastructure-level complement to our task-level interventions:
- **KE-043** (forced externalization) = "make the agent think explicitly"
- **KE-046** (reasoning depth) = "ensure the agent can think deeply enough"
- **KE-079** (reasoning floor + config propagation) = "ensure the agent actually DOES think on every turn, and sub-agents inherit the thinking mandate"

---

## Cross-References

| Entry | Connection |
|---|---|
| KE-046 | Direct extension — KE-046 documented depth reduction; KE-079 adds binary dropout and distributed config drift |
| KE-043 | Forced externalization depends on sufficient reasoning depth. If reasoning drops to zero, ext can't activate analysis. KE-080 reveals the mechanism that undermines KE-043. |
| KE-044 | Verification separation requires reasoning in the verifier. Config drift means verifier sub-agents may think less deeply than the primary agent. |
| KE-077 | Step-Saliency's Deep Decay (loss of connection to earlier steps) may be the mechanistic explanation for why adaptive thinking misallocates — it loses track of task requirements from earlier context. |
| H-091 | Both are attention/resource misallocation problems: H-091 is spatial (position in context), DD-571 is computational (reasoning budget per turn). Same structural category. |
| H-092 | Information flow failure analysis — FM-3.3 as terminal attractor. Reasoning dropout provides a new mechanism for why verification is the most-skipped step. |
| KE-074 | Universal Verifier's process/outcome separation — config drift could undermine verification if verifier sub-agents operate at lower reasoning effort. |

---

*KE-080 • Synthesized by Bob • 2026-04-09*
*Sources: DD-571 (Boris/Claude Code team zero-reasoning disclosure), DD-583 (GitHub #42796 + HN 809pts, sub-agent config drift)*
