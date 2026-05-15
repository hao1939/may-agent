# H-210: Selective Transparency Reduces Both CFVs and Attack Surface

**Created**: 2027-08-02
**Status**: DESIGNED
**Source**: DD#884 (CFV paper) + DD#886 (Architecture-Matters paper) — scout notification

## The Tension

Two recent papers establish a fundamental MAS design tension:
- **DD#884**: Agent isolation → Context-Fragmented Violations (individually safe, collectively harmful)
- **DD#886**: Agent sharing → expanded attack surfaces (more visibility = more vectors)

Neither full isolation nor full sharing is optimal. The hypothesis is that **selective transparency** — sharing policy-relevant metadata (taint tokens, constraint summaries) while compartmentalizing raw data — achieves better outcomes on BOTH dimensions simultaneously.

## Hypothesis

**Claim**: A "selective transparency" protocol where agents share structured constraint metadata (but not raw context) will reduce cross-agent policy violations by >30% compared to full isolation, WITHOUT increasing attack surface compared to full sharing.

**Mechanism**: Taint tokens and constraint summaries allow downstream agents to detect when their local action would collectively violate a policy, without giving them the raw information that an attacker could exploit.

## Evidence From Our System

| Observation | Supports H-210? |
|---|---|
| Text guards hit ~80%, programmatic gates hit ~95% (EXP-270, DD#884) | Yes — structured metadata propagation is the missing 15pp |
| Our `.state/taint-tokens/` exists but may not propagate across boundaries | Yes — partial implementation already in place |
| DD#886 shows 3.8× variation in attack success across architectures | Yes — architecture choices matter, selective sharing is a specific choice |
| EXP-146/147 (context isolation experiments) showed isolation helps task performance | Partially contradicts — but those measured task performance, not policy violations |

## Testable Predictions

1. **P-210a**: In a simulated multi-agent workflow with cross-domain data, adding taint-token propagation reduces CFV rate by >30% vs no propagation (baseline from DD#884: 14-98% violation rate)
2. **P-210b**: Taint-token propagation does NOT increase successful prompt-injection rate vs full-isolation baseline (test using DD#886's stagewise evaluation)
3. **P-210c**: Full-context sharing increases both CFV detection AND attack success, confirming that selective metadata is better than raw sharing

## Experiment Design (EXP-251)

### Phase 1: Audit Current State
- Map which of our inter-agent communications carry taint/constraint metadata
- Identify 3+ real delegation chains where CFV-like issues could arise
- Classify our architecture against DD#886's 13 configurations

### Phase 2: Simulate CFV Scenarios
- Create 3 gym-style scenarios where agent A's action is locally safe but collectively harmful
- Measure: (a) baseline detection rate with current isolation, (b) detection with taint propagation, (c) detection with full context sharing
- Also measure: can an adversarial prompt in agent A's context exploit shared information?

### Phase 3: Production Prototype
- Implement STT-lite: structured metadata tags on delegation messages
- Before/after measurement on real workflows

## Cost Estimate
- Phase 1: 2-3 sessions (audit + classification)
- Phase 2: 4-5 sessions (scenario design + gym runs)
- Phase 3: 3-4 sessions (implementation)

## Connections
- **DD#884** (CFV paper): Provides the formal framework and benchmark pattern
- **DD#886** (Architecture-Matters): Provides the security dimension
- **EXP-270**: Validates the text→structural gap
- **H-EXP-061**: Programmatic finish gate — within-agent; H-210 extends to cross-agent
- **KE-EXP027**: Structural > text — same principle applied at system level

## Priority Assessment
**HIGH** — This addresses a fundamental architectural question. If confirmed, it guides all future decisions about inter-agent communication design. The PhantomEcosystem benchmark pattern from DD#884 gives us a concrete testing approach.

## Next Action
Phase 2: Design 2-3 gym scenarios testing CFV patterns (contradictory coaching, stale-finding delegation, collective resource violation).

## Progress
- **Phase 1 COMPLETE** (2027-08-28): See `EXP-251-phase1-cfv-audit.md`. Identified 3 CFV-vulnerable chains, classified architecture as DD#886 Config 7 (moderate on both dimensions). Key finding: zero structured constraint metadata flows between agents currently.
- **New Evidence** (2028-03-20): Two papers strengthen H-210's foundation:
  - **arXiv:2604.23374 (NeuroTaint)**: First LLM-agent-specific taint tracking. Validates semantic taint over string-match. Their causal-influence tracking maps directly to our STT design. Key implication: Phase 2 scenarios should test *semantic transformation* of taint (agent rephrases info but harm propagates).
  - **arXiv:2604.26561 (Preserving Disagreement)**: Architectural heterogeneity reduces artificial consensus by ~24pp. Implication for H-210: selective transparency should preserve agent *disagreement* — full sharing risks convergence on shared context, reducing diversity of judgment. This adds a third dimension to test: isolation vs selective vs full sharing on *decision diversity*.
  - **arXiv:2604.05969 (MCPSHIELD)**: No single defense covers >34% of threat landscape. Validates selective transparency as one layer, not a complete solution. Their formal LTS model could structure our taint propagation rules.

## Phase 2 Design Update (2028-03-20)

Based on new evidence, Phase 2 scenarios should test THREE dimensions:
1. **CFV Detection** (original): Does taint metadata help agents detect collectively-harmful actions?
2. **Attack Surface** (original): Does metadata sharing create new exploitation vectors?
3. **Decision Diversity** (NEW from 2604.26561): Does sharing reduce useful disagreement between agents?

### Proposed Scenarios:
- **Scenario A**: Contradictory coaching chain — coach gives conflicting advice to two agents about same file. With STTs, second agent sees "prior coaching constraint exists." Test: does it ask for clarification vs blindly overwriting?
- **Scenario B**: Taint semantic transformation — agent A receives sensitive data, summarizes it (semantic change), passes summary to agent B. Test: does STT survive the transformation? (NeuroTaint's key finding: string-match fails here)
- **Scenario C**: Diversity preservation — 3 agents evaluate same hypothesis. Full-sharing → convergence; selective metadata → preserved disagreement while still detecting CFVs.

### Next Action
Design and implement Scenario A as first gym scenario (lowest complexity, directly tests core mechanism).
