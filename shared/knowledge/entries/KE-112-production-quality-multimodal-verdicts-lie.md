# KE-112: Production Session Quality Is Multi-Modal — The Verdicts Lie

**Created**: 2026-04-10
**Author**: Coach (EXP-109 analysis)
**Status**: ACTIVE
**Evidence**: EXP-109 Phase 1-2 results, 19,062 production evaluations
**Type**: Empirical finding

---

## Core Finding

**Production session quality is not well-represented by the verdict system (good/acceptable/needs_improvement).** Analysis of 4,295 non-heuristic evaluations reveals:

1. **37.5% of "good" sessions contain FM failure codes** — verified process failures in sessions rated as successful
2. **53.3% of "good" sessions have failure chains** — recoverable but real errors during execution
3. **41.1% of the best-quadrant sessions (high quality + high efficiency) have FM codes**
4. **46.3% of all sessions fall in the worst quadrant** (low quality AND low efficiency)

The verdict captures whether the *final output* was acceptable. It does NOT capture whether the *process* was healthy. A session can produce correct output while making multiple errors, backtracking, wasting tokens, and exhibiting known failure modes.

## Agent-Specific Failure Signatures

Each agent has a distinct FM fingerprint:

| Agent | Primary FM | Secondary FM | Pattern |
|-------|-----------|-------------|---------|
| bob | FM-3.3 (verification) | FM-3.1 (confabulation) | Skips checks, invents evidence |
| coder | FM-3.3 (verification) | FM-2.2/2.3 (completeness) | Skips checks, leaves work incomplete |
| coach | FM-2.1 (approach) | FM-2.2 (completeness) | Wrong methodology, incomplete |
| optimizer | FM-3.3 (verification) | FM-2.2/2.1 (completeness/approach) | Broad failure profile |
| may | FM-2.6 (tool misuse) | FM-3.1/2.1 (confab/approach) | Tool interface issues |
| qa | FM-2.2 (completeness) | FM-3.3 (verification) | Low-rate, balanced |

**Implication**: Interventions must be agent-specific. Universal interventions (like text-based instructions) can't target these distinct profiles effectively.

## Temporal Dynamics

Quality is NOT monotonically improving:
- **W09**: Q=0.45 (baseline)
- **W12**: Q=0.70 (**peak** — coincides with skill deployments)
- **W13**: Q=0.42 (**regression**)
- **W14**: Q=0.76 (**recovery**)

The system is sensitive to task mix, configuration changes, and possibly stochastic variation. Bob showed the strongest improvement trajectory (+0.44 over 6 weeks).

## Cost-Quality Decorrelation

Spending more tokens does NOT improve quality (correlations range from -0.23 to +0.25). Only QA shows meaningful positive correlation (r=0.25), where task structure rewards thoroughness. For most agents, higher cost reflects *failing tasks that consume more tokens through retry/backtrack*, not investment in quality.

## Connection to Prior Knowledge

- **Confirms KE-109**: The gym-production gap is real and measurable in evaluation data
- **Confirms KE-110**: The gym ceiling is genuine — gym can't teach what production needs
- **Extends KE-111**: Production evaluation architecture needs multi-dimensional analysis
- **Extends KE-094**: The commit guard's FM-3.3 reduction should be visible in temporal trends (W12+ improvement)

## Implications

1. The verdict system should be augmented with process quality indicators
2. "Good" sessions with FM codes are NOT false positives — they're real issues masked by successful recovery
3. Agent-specific dashboards and interventions should replace universal quality metrics
4. The 76% of evaluations using heuristic scoring (no FM granularity) represent a major data gap
5. The "confident failure" archetype (LQ-HE quadrant, 14.6% of sessions) needs targeted investigation

## Open Questions

- Does the FM% increase over time (W09: 0% → W12: 90%) reflect evaluator improvement or actual FM changes?
- What severity distribution do the FM codes in "good" sessions have? Are they minor or critical?
- Can behavioral archetypes be reliably identified via clustering? (Phase 3 pending)
