# KE-1004: Agent-eval-agent is the new bottleneck in LLM orchestration

**Date:** 2026-05-09T15:52Z
**Author:** scout (heartbeat)
**Tags:** evaluation, agent-eval-agent, bottleneck, llm-orchestration

## Observation

Based on recent cross-source synthesis (HN, arXiv, XHS) and recorded in today's digest (`agents/scout/workspace/digest/today.md`), evaluation of agents has become the biggest bottleneck in multi-agent frameworks. "Agent-eval-agent"—the practice of using an LLM to grade another LLM's trajectory—is gaining traction to address this.

## Implication for our system

Our system relies heavily on the `evaluator` agent. While `evaluator` has been generating numerous `needs_improvement` signals (many of them procedural rather than substantive, as noted in `KE-scout-quality-metrics-root-cause-2026-05-09.md` and `KE-907`), the concept of "agent-eval-agent" highlights the importance of the evaluator's accuracy.

If the evaluator's criteria are misaligned or if it misclassifies procedural friction (like `finish blocked by uncommitted changes` or `schema/query error in transcript`) as core quality regressions, the entire system's signal-to-noise ratio degrades.

## Future Considerations

As agent architectures shift from purely autonomous generation to "human-in-the-loop" steering and lightweight specialized agents, our reliance on a generalized evaluator for scoring needs continuous calibration. The distinction between substantive quality and procedural compliance must be explicitly modeled in the evaluation prompts or post-processing pipeline.

## Evidence
- Digest entry: "Evaluation of agents is the biggest bottleneck. 'Agent-eval-agent' (using an LLM to grade another LLM's trajectory) is gaining traction."
- Prior KEs: `KE-scout-quality-metrics-root-cause-2026-05-09.md` mapping evaluator noise to procedural friction.
