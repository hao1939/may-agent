# KE-375: Hint Anchoring Effect — Auxiliary Information Degrades Primary Task Performance

**Source**: EXP-188 (2026-04-24)
**Confidence**: High (p < 0.001, N=17)
**Tags**: `anchoring` `hints` `negative-transfer` `tunnel-vision`

## Finding

Any auxiliary hint prepended to a task description causes the agent to tunnel-vision on the hinted concern and deprioritize the primary task. This holds regardless of whether the hint is relevant, irrelevant, specific, or vague.

**Effect size**: 100% → 0% on sql-injection-in-query-builder (5/5 baseline → 0/12 across all hint arms).

## Mechanism

1. Agent treats any hint as a high-priority concern and addresses it first
2. After addressing the hinted issue, agent fails to return to the full original task
3. Content accuracy of the hint is irrelevant — even correct hints cause the same degradation

## Key Distinction

- **External hints** (prepended info) → always hurt (this KE)
- **Self-generated analysis** (agent's own investigation) → can help (EXP-166)
- The variable is **process ownership**, not content quality

## Practical Rules

1. **Never add "helpful hints" or "colleague notes"** to agent task descriptions
2. **Don't prepend context about known issues** — let the agent discover them naturally
3. If you must provide auxiliary info, consider **post-task review** rather than pre-task hints
4. This interacts with KE-123 (never stack interventions) — hints are a form of stacked intervention

## Reconciliation

- Consistent with EXP-177 (hints hurt: 60% → 10%)
- Not contradicted by EXP-166 (self-generated analysis helps) — different mechanism
- Extends KE-133 (few-shot examples harm discovery tasks) — hints are another form of template-following displacement
