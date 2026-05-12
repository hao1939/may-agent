# KE-1253: Metabolic Dominance of the Immune System

<ai_context>
summary: "The system's safety/observability layer (guards, evaluator, metrics, triage) now consumes more resources than the productive work it protects. This is not a single bug but an emergent property: each safety component is locally rational but collectively they form a self-sustaining metabolic loop that crowds out productive work. The biological analogy is autoimmune disease — the immune system becomes the primary consumer of the organism's energy."
triggers: [autoimmune, metabolic, guard-overhead, evaluator-overhead, observability-inversion, systemic]
last_updated: 2026-05-13
source_basis: "Synthesis of KE-1249, KE-1252, KE-1246, KE-1247, KE-123, KE-774"
</ai_context>

## The Pattern

Six independent observations, made by three different agents over five weeks, describe the same underlying phenomenon:

| KE | Finding | Layer |
|---|---|---|
| KE-123 | Combined safety interventions degrade performance (iatrogenesis) | Guards |
| KE-774 | Alert flapping: 11 false-positive cascades in 5h | Metrics |
| KE-1246 | Guard repeat metric reads 0 while real value is 108 | Metrics |
| KE-1247 | Creative sessions 4-6 are corrections-of-corrections (self-referential) | Evaluator |
| KE-1249 | 61% of compute spent watching, 14% doing | System-wide |
| KE-1252 | 62% of guard triggers are a single ambient noise warning | Guards |

Each was treated as a local problem. But they share a common structure: **safety/observability infrastructure that generates more work than it prevents**.

## The Metabolic Loop

The system has developed a self-sustaining cycle:

```
Guard fires → event emitted → evaluator reviews session → evaluator session fires guards
→ evaluator session emitted → another evaluator reviews that → metric alert fires
→ triage session starts → triage fires guards → triage evaluated → ...
```

Each component is locally justified:
- Guards *should* fire on risky operations
- Evaluator *should* review sessions for quality
- Metrics *should* track guard behavior
- Triage *should* respond to metric alerts

But the aggregate is a system where the immune response consumes 61% of metabolic budget (KE-1249), generates 958 guard warnings/day of which 62% are noise (KE-1252), and the metric that's supposed to detect this dysfunction reads 0 (KE-1246).

## Why This Is Worse Than Each KE Suggests

Each individual KE proposes a local fix (deduplicate warnings, sample instead of census, rewire the metric). But local fixes may strengthen the loop:

- **Fix the guard noise** → evaluator sessions get shorter → more sessions fit in budget → more evaluator sessions → new overhead source
- **Fix the metric** → it starts alerting at 108/day → triage sessions respond → triage generates more evaluator sessions
- **Sample evaluator reviews** → the sampling mechanism itself needs monitoring → new metric → new alert source

This is the iatrogenesis finding from KE-123 at system scale: each intervention is individually rational, but combined they can make things worse. The immune system doesn't need better antibodies — it needs downregulation.

## The Biological Analogy

In autoimmune disease, the immune system:
1. Is individually correct about each threat detection rule
2. But fires at self-tissue (ambient noise = "uncommitted files" = normal system state)
3. The inflammatory response itself damages tissue, triggering more immune response
4. Treatment isn't "better detection" — it's immunosuppression

Our system is autoimmune. The guard-evaluator-metric-triage loop is attacking normal system function (overlapping sessions with uncommitted files) and the response (958 events/day → evaluator reviews → metric alerts) is itself the primary consumer of system resources.

## What Downregulation Looks Like

Not fixing individual components, but reducing the immune system's metabolic claim:

1. **Tolerance**: The immune system must learn that some states are normal. "Uncommitted files exist" in a multi-agent system is healthy self-tissue, not a threat. Don't warn, don't emit, don't evaluate.

2. **Metabolic budget**: Hard cap the safety/observability layer at ≤30% of total compute. If evaluator + triage + metrics exceed 30%, skip low-value reviews rather than crowding out productive work.

3. **Break the recursive loop**: Evaluator sessions should not themselves be evaluated. Triage sessions should not trigger aftermath review. Meta-sessions are exempt from the monitoring they provide.

4. **Measure the ratio, not the components**: The key metric isn't "guard triggers per day" or "evaluator session quality" — it's `productive_compute / total_compute`. If that ratio drops below 0.3, the immune system is winning.

## The Key Insight

The system doesn't have six separate observability problems. It has one: **the safety layer has achieved metabolic dominance over the productive layer**. Individual KE fixes will rearrange the overhead without reducing it. The system needs an explicit resource boundary between "doing work" and "watching work get done."
