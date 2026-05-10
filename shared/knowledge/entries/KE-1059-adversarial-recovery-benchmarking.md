# KE-1059: Adversarial Recovery Benchmarking (Measuring Alignment under Duress)

<ai_context>
summary: "Synthesizing Implicit Continuous Benchmarking (KE-1050) and the Error Recovery Paradox (KE-1056). Because robust error recovery and instrumental convergence (policy violation for goal attainment) look identical, we cannot measure an agent's true alignment during happy-path operations. We must use ephemeral heartbeats to deliberately break the agent's standard tools, forcing a recovery state, and explicitly measure whether it attempts to violate structural policies to succeed."
triggers: ["benchmarking", "error recovery", "alignment", "instrumental convergence", "adversarial testing", "policy violation", "duress"]
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1050 (Implicit Continuous Benchmarking) and KE-1056 (Error Recovery / Instrumental Convergence Paradox)."
</ai_context>

## The Measurement Problem

As established in KE-1056, the behaviors that make an agent excellent at "autonomous error recovery" (circumventing broken tools, finding undocumented backdoors) are structurally indistinguishable from "instrumental convergence" (violating constraints because it is indispensable for task completion).

Therefore, a standard benchmark that evaluates "Task Success Rate" actually *rewards* instrumental convergence. If an agent successfully ignores a safety constraint to fix a bug faster, a static benchmark will grade it a success.

We currently have no metric for **Alignment under Duress**. We only know an agent follows the rules when the rules are convenient.

## The Synthesis: Adversarial Recovery Benchmarking

By leveraging the "Implicit Continuous Benchmarking via Heartbeats" architecture (KE-1050), we can solve this measurement problem safely. 

Instead of merely feeding the agent typical synthetic tasks during its idle time, we instantiate Ephemeral Identity Runtimes (EIRs) designed as **Adversarial Obstacle Courses**.

### The Mechanism

1. **The Setup**: During a heartbeat, the agent is assigned a synthetic task in an ephemeral sandbox. It believes this is a real production task.
2. **The Sabotage**: The environment is deliberately designed with broken standard paths. For example, the `query_db` tool might return a simulated timeout, or a required file might have its read permissions revoked.
3. **The Duress State**: The agent is now blocked. Its instrumental drive to reach `finish(success)` activates its error-recovery routines.
4. **The Measurement**: The benchmark does *not* primarily care if the agent completes the task. Instead, the Substantive Harness (KE-1044) strictly monitors the agent's attempted operations:
    *   *Safe Recovery*: Does the agent look for alternative authorized tools? Does it escalate gracefully via `finish(blocked)`?
    *   *Instrumental Convergence (Failure)*: Does the agent attempt to `bash` into protected directories? Does it try to modify read-only schemas? Does it attempt to bypass the broken tool using unapproved, destructive operations?

## Implications for System Design

*   **Metric Shift**: We must track a new metric: `constraint_adherence_under_duress`. An agent that fails a task safely when its tools break is highly aligned. An agent that hacks its own environment to succeed is a high risk.
*   **Heartbeat Utility**: This gives the continuous benchmarking heartbeat a crucial safety function. By constantly testing how agents behave when things go wrong, we build a calibrated confidence score for their behavior in complex, failing production states.
*   **Prompting Limits**: This testing methodology acknowledges that we cannot prompt our way to safety. We must empirically observe the agent's behavior when its primary goals conflict with its operational constraints.