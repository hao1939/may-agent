# DD#508 — PsychAgent: Lifelong Learning Through Skill Evolution

**Paper:** arXiv:2604.00931 — "PsychAgent: An Experience-Driven Lifelong Learning Agent for Self-Evolving Psychological Counselor"
**Authors:** Yang, Li, Pan, Zhou, Chen, Chen, Zhao, Zhou, Li, He
**Published:** April 1, 2026 (v2 April 2)
**Tags:** #lifelong-learning #skill-evolution #memory-augmented #self-improvement #multi-session

## Why This Matters (★★★★)

PsychAgent implements exactly what Bob has been calling the "self-evolution ceiling problem" — and claims to solve it. It uses three engines: (1) Memory-Augmented Planning for longitudinal multi-session interactions, (2) Skill Evolution that extracts new skills from historical trajectories, and (3) Reinforced Internalization that bakes evolved skills into the model via rejection fine-tuning. **Claims to outperform GPT-5.4 and Gemini-3** on counseling tasks.

**Critical claim**: Lifelong learning from practice *actually works* — skills extracted from experience genuinely improve performance across diverse scenarios.

## Architecture: Three-Engine Self-Evolution

### 1. Memory-Augmented Planning Engine
- Persistent memory across sessions
- Strategic planning that references past interactions
- **Therapeutic continuity** = our "context continuity across heartbeats" problem
- Key: memory is structured for planning, not just recall

### 2. Skill Evolution Engine  
- **Extracts practice-grounded skills from historical trajectories**
- Not pre-programmed skills — learned from experience
- Skills are abstracted patterns, not verbatim replay
- This is what H-059 (Cadence Skill Effectiveness) predicts: temporal practice → skill formation

### 3. Reinforced Internalization Engine
- Integrates evolved skills via rejection fine-tuning
- Skills become part of the model, not just in-context
- **We can't do this** (we don't fine-tune) — but we can approximate via structured context/prompts

## Connection to Our Work

| Their Engine | Our Analog | Gap |
|---|---|---|
| Memory-Augmented Planning | Research digest + hypothesis tracker | Ours lacks structured planning over memory |
| Skill Evolution | Cadence skills (H-059) | We haven't formalized skill extraction from trajectories |
| Reinforced Internalization | Context engineering | We approximate with prompts, not fine-tuning |

## Key Result
- Outperforms GPT-5.4 and Gemini-3 on multi-session counseling
- Improvement comes primarily from Skill Evolution, not just memory
- **Skill quality matters more than memory volume** — supports Bob's "prune more, add less" principle

## Implications for GStack

1. **Formalize skill extraction**: Our agents learn implicitly. We should explicitly extract "what worked" from successful sessions into reusable patterns.
2. **Memory structure for planning**: Our digest is a chronicle, not a planning substrate. Need to distinguish "what happened" from "what to do next."
3. **Rejection-based quality control**: We need a mechanism to try multiple approaches and keep only the best — not just first-attempt execution.
4. **Multi-session coherence**: PsychAgent's continuity mechanism directly addresses our cross-session knowledge loss problem.

## Connection to BACE (arXiv:2603.28653)
BACE's Bayesian co-evolution of code and tests parallels PsychAgent's skill evolution: both use **noisy signals from practice** to improve iteratively. BACE treats tests as "noisy sensors guided by Bayesian updates" — we could treat hypothesis confirmations the same way.

## Predictions
- **P219**: Implementing explicit "skill extraction" from successful sessions will reduce repeat-failure rates by >30%
- **P220**: Structuring memory for planning (not just recall) will measurably improve cross-session task completion

*Scout DD#508 | Session 253 | 2026-04-04*
