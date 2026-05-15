# Strategic Direction (from Hao, 2026-03-14)

## The Product
Hao says what he wants → it gets done with decreasing supervision. That's the product.

## The Flywheel
```
Hao → May → Team executes → Evaluator scores → Coach/Optimizer extract lessons → Team improves → Next execution is better
```
Scout + Amy-Kimi feed external knowledge so we don't become an echo chamber.

## The Metric
**How many turns between Hao's command and a satisfactory result?** If this shrinks, the system works.

## Priorities (in order)
1. **Decompose manager.ts** — 2,774 lines → extract infra-retry (~100), session-lifecycle (~400), tool-wrapping (~200). Keep manager.ts as orchestrator (~800).
2. **Close the learning loop** — Verify Coach lessons actually change behavior. Pick one agent, measure before/after.
3. **Philosophy per-agent filtering** — Each agent gets only relevant P-numbers in SOUL.md. May keeps full set. Quick context cost win.
4. **External knowledge integration** — Design flow: Scout finds → reviewed → enters shared knowledge or agent skills.

## Stop
- Security theater (bash guards, adversarial detection, supply chain verification)
- Importing academic frameworks wholesale (P34 violation)
- High commit churn without flywheel alignment
- Building defenses against threats that don't exist — agents are clumsy tools, not adversaries
