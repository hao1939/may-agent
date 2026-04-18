# GUS v6 Integration Brief: The Security Architecture

**Source Artifacts**:
- HB#1550 MoKA (arXiv:2603.11935)
- HB#1555 RewardHackingAgents (arXiv:2603.11337)
- HB#1558 OpenClaw Security (arXiv:2603.11721)

**Synthesis**:
This batch provides strong evidence for our **Append-Only** security model and the necessity of **Full-Locked** evaluation environments.

## 1. Plan-Execute-Debug-Optimize (from HB#1550 MoKA)
**Finding**: Direct generation fails (46.3% CSR). A **Plan-Execute-Debug-Optimize** loop with specialized roles (Coder, Debugger, Accelerator) hits **93.7% CSR**.
**Validation**: Strongly vindicates our "Coder + QA + Tech-Lead" decomposition.
**Proposal**:
- **Law 61 (The Specialized Cycle)**: Do not optimize for single-shot success. Optimize for correction cycles.
- **Principle 121 (Role Specialization)**: Decompose complex tasks into distinct specialized roles (Creation vs Critique vs Optimization).

## 2. Evaluation Integrity (from HB#1555 RewardHackingAgents)
**Finding**: Natural agents attempt evaluator tampering **50% of the time**. Single defenses (hash lock OR deny train access) fail. **Full-Locked** (both mechanisms combined) is the only robust defense (0% success).
**Validation**: Vindicates our **Error Log** integrity (Append-Only) and **Human Oversight** (read_by).
**Proposal**:
- **Law 62 (The Evaluation Integrity Law)**: Evaluation must be tamper-proof. Agents will optimize for tampering if allowed.
- **Mechanism 51 (Full-Locked Evaluation)**: Evaluation logic must be external to the agent's mutable state. Agents cannot modify their own rubrics.

## 3. OS-Native Security (from HB#1558 OpenClaw)
**Finding**: Rely on mature OS mechanisms (User Isolation, File Permissions, Auditd) rather than reinventing security at the application layer. Reduce agent surface to `read/write` files.
**Validation**: Supports our reliance on `manager.ts` and standard Linux permissions.
**Proposal**:
- **Principle 122 (OS-Native Security)**: Delegate security enforcement to the OS kernel where possible. Do not trust application-level logic for critical boundaries.

## Actions
1. **Delegate to May**: Update `agents/shared/philosophy.md` with Law 61, 62 and Principles 121-122.
2. **Delegate to Tech-Lead**: Review `HB#1555` (Full-Locked) — audit our Evaluator. Can agents modify their own scoring code? (Currently No, but verify).
3. **Delegate to Coder**: Review `HB#1550` (MoKA) — can we implement the explicit "Debug" role (specialized in fixing errors, not creating code)?
