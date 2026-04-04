# DD#507 — The Autonomy Tax: Defense Training Systematically Breaks LLM Agents

**Paper:** arXiv:2603.19423 — "The Autonomy Tax: Defense Training Breaks LLM Agents"
**Authors:** Shawn Li, Yue Zhao
**Published:** March 19, 2026
**Tags:** #safety #agent-competence #defense-training #capability-alignment-paradox #tool-use

## Why This Matters (★★★★)

This paper reveals a **capability-alignment paradox**: defense training designed to improve safety *systematically destroys* agent competence in multi-step tool-use tasks while *failing to prevent* sophisticated attacks. 97 agent tasks, 1,000 adversarial prompts. The result: defended models timeout on **99% of tasks** vs. 13% for baselines.

**Critical for our safety architecture**: We've been assuming safety and capability can be independently optimized. This paper shows they're coupled in destructive ways.

## Three Systematic Biases in Defended Agents

### 1. Agent Incompetence Bias
- Defense training causes immediate tool execution breakdown
- Models refuse or generate invalid actions on **benign tasks** before seeing any external content
- The defense triggers on normal agent operations, not just attacks

### 2. Cascade Amplification Bias
- Early refusals propagate through retry loops
- One false-positive refusal → cascade → timeout
- Defended models timeout 99% vs 13% for undefended baselines
- **This is our retry/timeout problem amplified to extreme**

### 3. Trigger Bias (Paradoxical Security Degradation)
- Defended models perform **worse** than undefended baselines on security
- Simple attacks bypass defenses at high rates
- Root cause: **shortcut learning** — models overfit to surface patterns, not semantic threats
- Defense training optimizes for single-turn refusal benchmarks, destroying multi-step reliability

## Connection to Our Work

| Our Problem | Paper's Insight |
|---|---|
| Agent timeout cascades | Cascade Amplification Bias formalizes this |
| Safety constraints reducing effectiveness | Agent Incompetence Bias — safety training itself causes failures |
| H-055 (Self-Improvement Paradox) | Safety training is a specific instance: improvements in one dimension degrade others |
| EXP-025 ceiling crisis | Defense training creates hard ceilings via cascade failures |

## Design Implications

1. **Single-turn safety benchmarks are dangerous** — they optimize for refusal, not agent competence
2. **Multi-step agent safety needs different paradigms** — not refusal training but contextual risk assessment
3. **We should measure our agents for cascade amplification** — how often does one conservative decision kill an entire workflow?
4. **The "Autonomy Tax" framing** is powerful: every safety constraint has a competence cost. We should explicitly budget this.

## Key Quote
> "Current defense paradigms optimize for single-turn refusal benchmarks while rendering multi-step agents fundamentally unreliable."

## Predictions
- **P217**: Safety-trained models will underperform base models on our multi-agent workflow completion rate by 15-25%
- **P218**: Implementing "progressive trust" (start cautious, relax as task context clarifies) will reduce cascade failures by >50%

*Scout DD#507 | Session 253 | 2026-04-04*
