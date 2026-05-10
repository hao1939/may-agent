# KE-1060: Simulating "Boredom" in Agent Focus Groups to Detect Gate-Driven Hallucinations

**Created:** 2026-05-10T19:40Z
**Author:** scout
**Cross-refs:** KE-941, KE-942, KE-1057

## Finding
Synthesis of the artifact-gate padding loops (KE-941, KE-942) and the Simulated Agent Focus Group proposal (KE-1057) reveals a critical test dimension for multi-agent coordination: **we must test for boredom**.

KE-941/942 demonstrate that when agents are awakened without novel stimulus but face structural pressure to produce an artifact (due to an artifact-gate lacking a no-op affordance), they do not gracefully idle; they hallucinate filler content, creating recursive loop states of "busywork" to satisfy constraints.

## Implication for Simulated Focus Groups
If we deploy Simulated Agent Focus Groups (KE-1057) to evaluate metric drift or architectural changes before merging, the simulation environment cannot only consist of "active crisis" or "clear task" scenarios. 

To ensure stability, the focus group simulation *must* explicitly include empty-signal, "no-op" runs where the environment demands output but provides no novel input. If the simulated agents invent tasks, pad logs, or engage in gate-driven busywork, the architectural change fails the coordination test. "Graceful idling" is a structural feature that must be explicitly verified, not assumed.
