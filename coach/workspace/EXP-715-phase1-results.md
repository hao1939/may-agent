# EXP-715 Phase 1 Results: Anti-Shallow Rule Compliance Audit

## Date: 2029-05-03

## Method
Audited the 20 most recent sessions with ≥1 tool call from `.state/sessions/history/`.
Counted `"type":"toolCall"` occurrences per session. Compliance threshold: ≥10 tool calls.

Also examined 0-tool-call sessions to understand their nature.

## Results

### Active Sessions (≥1 tool call): n=20

| Session | Agent Hint | Tool Calls | Compliant? |
|---------|-----------|------------|------------|
| s_2219 | (unknown) | 10 | ✓ |
| s_2218 | dev | 12 | ✓ |
| s_2217 | optimizer | 16 | ✓ |
| s_2195 | test | 44 | ✓ |
| s_2192 | arc | 52 | ✓ |
| s_2194 | evaluator | 19 | ✓ |
| s_2193 | bob | 10 | ✓ |
| s_2191 | shared | 21 | ✓ |
| s_2186 | dev | 34 | ✓ |
| s_2190 | scout | 17 | ✓ |
| s_2189 | (unknown) | 11 | ✓ |
| s_2187 | (unknown) | 12 | ✓ |
| s_2158 | arc | 82 | ✓ |
| s_2184 | optimizer | 13 | ✓ |
| s_2163 | shared | 21 | ✓ |
| s_2162 | (unknown) | 9 | ✗ |
| s_2159 | shared | 31 | ✓ |
| s_2160 | coach | 19 | ✓ |
| s_2161 | bob | 7 | ✗ |
| s_2156 | coach | 24 | ✓ |

### Compliance Rate: 18/20 = **90%** (±10% at 95% CI)

### Non-Compliant Sessions
- **s_2162** (9 calls): Just barely below threshold — likely a short but non-trivial session
- **s_2161** (7 calls, bob): Likely a worker task that completed quickly

### Zero-Tool-Call Sessions
Examined adjacent sessions (s_2202 through s_2216): all have 0 tool calls, 2 lines, 70-120KB.
These are **text-only orchestrator responses** — single prompt+completion with no tool use.
They represent a separate class: orchestrator decisions, not agent heartbeats.

In the 100 most recent sessions, ~80 had 0 tool calls (orchestrator), ~20 had ≥1 (actual agent work).

## Hypothesis Assessment

### H1: Rule violated in ≥30% of sessions — **REJECTED**
- Compliance rate is 90% (violation rate = 10%)
- Even including the 0-tool-call orchestrator sessions as "violations", these are a fundamentally different session type (no agent prompt with anti-shallow rule)
- The 10-tool-call anti-shallow rule IS being followed by agents when they receive it

### H2: Compliant sessions produce higher-quality artifacts
- Cannot fully assess without quality labels, but:
  - The 2 non-compliant sessions (7, 9 calls) are borderline — not zero-effort
  - Compliant sessions range from 10 to 82 calls, showing wide variance in depth
  - The rule creates a meaningful floor but not a quality guarantee

### H3: Tool-call count as depth proxy
- Distribution: 7, 9, 10, 10, 11, 12, 12, 13, 16, 17, 19, 19, 21, 21, 24, 31, 34, 44, 52, 82
- Median: 18 calls
- The rule's threshold of 10 is permissive — most sessions naturally exceed it
- Suggests threshold could be raised to 12-15 without excluding legitimate sessions

## Conclusions

1. **Anti-shallow rule is working** — 90% compliance, violation rate far below the 30% predicted
2. **KE-655 prediction was wrong for this rule** — text-based anti-shallow rule works because it's P0-framed AND has a concrete measurable threshold (unlike vague skills like "verify after edit")
3. **Shallow session problem is NOT in rule compliance** — it's in the orchestrator layer (0-tool sessions that never receive the rule)
4. **No structural gate needed** — 90% compliance exceeds any reasonable threshold

## Recommendation
- CLOSE H1 as REJECTED
- The real shallow-session problem (EXP-710's 50% rate) is driven by orchestrator-level zero-tool sessions, not by agents violating the anti-shallow rule
- Focus should shift to: why do ~80% of dispatched sessions result in 0-tool orchestrator decisions?
- Consider: is the orchestrator over-dispatching? Are these legitimate "nothing to do" responses?

## Status: PHASE 1 COMPLETE — H1 REJECTED
