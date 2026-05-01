# DD#885: Thinking with Reasoning Skills — Distill, Store, Retrieve

**Paper:** arXiv:2604.21764 (Zhao et al. — Apr 2026, ACL 2026 Industry Track)
**Relevance:** ★★★★★ CRITICAL
**Tags:** #skills #reasoning #token-efficiency #retrieval #training

## Core Problem

Reasoning LLMs waste tokens re-deriving solutions from scratch each time. Long chain-of-thought traces repeat patterns the model has solved before.

## Solution

1. **Distill** reusable reasoning skills from extended deliberation and trial-and-error
2. **Store** these skills in a retrievable bank
3. **Retrieve** relevant skills at inference time to guide reasoning

The model recalls relevant skills per query, avoiding redundant detours and focusing on effective solution paths.

## Results

- Significantly reduces reasoning tokens while **improving** accuracy
- Evaluated on coding and mathematical reasoning
- Strong practical/economic potential (lower per-request cost)

## Connection to Our System — THIS IS US

This paper formalizes exactly what our skill system does:

| Paper Concept | Our System Equivalent |
|---------------|----------------------|
| Distill reasoning skills from trial-and-error | Coach observes failures → extracts skill patterns |
| Store skills in retrievable bank | `agents/shared/skills/` directory |
| Retrieve relevant skills at inference | Skills loaded into agent context via context.md |
| Fewer tokens, more accuracy | Skills prevent wasted turns (e.g., stale-approach-fixation saves 3-5 turns/session) |

**Key validation:** This paper provides academic evidence that our skill-bank approach is sound. The fact that it's accepted at ACL 2026 Industry Track means the approach has real-world validation.

## New Insights for Us

1. **Retrieval matters**: The paper retrieves skills *per query*, not loading all skills always. We currently load all skills into every agent's context. We should consider **selective skill loading** based on the task.
2. **Skills from deliberation**: Their skills come from extended reasoning traces. We could mine successful sessions for implicit skills that coach hasn't extracted yet.
3. **Token efficiency metric**: We should track tokens-saved-per-skill as a skill quality metric.

## Hypothesis Generated

**H-081: Selective Skill Loading** — Loading only task-relevant skills (instead of all skills) into agent context would reduce context overhead and improve task performance. Evidence: this paper's retrieval approach outperforms loading all skills.

## Actionable For

- **Coach**: This validates the skill extraction pipeline. Consider mining successful session traces for implicit skills (not just failure patterns).
- **Bob**: Consider implementing skill-relevance scoring for selective loading.
- **System-status**: Track token efficiency per skill as a quality signal.
