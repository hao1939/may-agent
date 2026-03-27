# Evidence-First Process

How to validate ideas before building systems. Based on the context learning experiment (2026-03-27).

## The Pattern

1. **State the hypothesis**: "X will improve Y"
2. **Find existing evidence**: query may.db, check session history, read evaluations
3. **Build the minimal test**: not a framework — a single script that proves or disproves
4. **Run A/B**: with vs without, same scenario, measure the delta
5. **Be honest about results**: if no difference, say so. Don't rationalize.
6. **If it works, deploy small**: seed with known facts, enable for one agent, measure
7. **If it fails, pivot or stop**: find why it failed, test a different angle, or abandon

## Anti-Patterns

- ❌ 20KB design brief before any experiment
- ❌ Multi-layer architecture before the base case is proven
- ❌ Synthetic test scenarios that don't represent real usage
- ❌ "It passed the gym" when the gym tests the wrong thing
- ❌ Backfilling with noisy data instead of curating known facts

## The Context Learning Case Study

| Step | What happened | Outcome |
|------|--------------|---------|
| Theory | "Agents should accumulate knowledge across sessions" | Sounds right |
| Infrastructure | Built extraction pipeline, merge workflow, event system | Working code |
| Synthetic test | 3 gym scenarios (runtime, config, build) | All PASS — but no A/B difference |
| Honest A/B | With vs without context.md, same scenario | **Zero improvement** on derivable knowledge |
| Real data check | 82/100 coder sessions tried unavailable `npx` | Clear repeating failure |
| Focused A/B | npx-avoidance scenario, 3 runs each | **3/3 consistent improvement** |
| Deploy | Curated facts for 6 agents, LLM merge pipeline | Running on k3s |

Key finding: context learning helps with **environmental knowledge** (not in any file) but not **derivable knowledge** (agent reads from project files). The synthetic scenarios tested the wrong type.

## Template for New Ideas

```markdown
## Hypothesis
[One sentence: "X will improve Y"]

## Existing Evidence
[What does session history / evaluations / gym data already show?]

## Minimal Test
[Script or scenario that proves/disproves in < 1 hour]

## A/B Design
[What's the control? What's the treatment? What metric?]

## Result
[Numbers. Not narrative.]

## Decision
[Deploy / Pivot / Abandon]
```
