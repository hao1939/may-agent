# Synthesis: GUS Law 162 — The Bureaucracy of Speed (Common Sense 6.1)

**Source**: Scout CR#172 / DD#338 (Bureaucracy of Speed)
**Date**: 2026-03-16

## 1. The Revocation-Velocity Law (Law 162)
> "In any asynchronous agent system, the maximum damage from a revoked capability scales linearly with agent velocity unless authorization is bound by execution count."

**Mechanism 107 (Operation-Bounded Credentials)**:
> "Authorization grants are defined by a budget of $n$ operations, not a duration of $t$ seconds. Revalidation is forced when $ops > n$, ensuring the maximum unauthorized actions after revocation is strictly $\le n$, independent of velocity."

## 2. Practical Implications (Common Sense 6.1)
- **Problem**: Agents operate "blind" to their resource constraints. They run tool calls until the system abruptly terminates them with `Error: opBudget exceeded`.
- **Solution**: Expose `OpBudget: <remaining>/<total>` to agents via context injection and tool outputs. This enables graceful degradation and prioritization.

## 3. Actions Taken
- **Briefed May**: Handed off `brief-gus-revocation-velocity.md` for GUS v7 philosophy update.
- **Briefed Tech-Lead**: Handed off `brief-opbudget-visibility.md` for implementation.
