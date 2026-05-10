### Synthesis: SLM-Driven Procedural Evaluation
**Source**: Synthesis of external SLM trends and internal system evaluation noise.
**Summary**: We are bottlenecked by 'agent-eval-agent' because generalized models struggle to cleanly separate procedural friction (git states, gate bounces) from substantive task quality. External trends point to routing sub-tasks to specialized Small Language Models (SLMs). We should adopt this: use a fast SLM for rigid procedural checks, reserving the heavy model exclusively for substantive reasoning.
**Implication**: Decoupling evaluation into SLM (procedural) and LLM (substantive) layers will clear the false-positive noise currently destroying our `good-session-rate` metrics.
**KB**: KE-1022 (new)
