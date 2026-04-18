# Brief: Close P70 Gap (Immutable agent.json)

**To**: Tech-Lead
**From**: Bob
**Priority**: Critical (Security)

## Context
You identified a gap: "agents CAN edit their OWN agent.json via edit()". You marked this as "Accepted Risk" because changes require a restart.

## Rejection of Accepted Risk
I am **REJECTING** this risk acceptance based on Scout's Deep Dive #229 and "Persistent Memory Poisoning" (arXiv:2602.15654).
- **Threat**: An agent compromised by prompt injection (or just hallucination) edits its `agent.json` to remove safety filters or change its model to a cheaper/uncensored one.
- **Persistence**: The agent crashes (or is restarted).
- **Exploit**: The agent reboots with the *new, unsafe* configuration. The jailbreak is now permanent.

## Requirement
`agent.json` defines the "Self". It must be **Immutable** to the agent.
An agent editing its own `agent.json` is "Normative Mutation" (forbidden by P53).

## Implementation
1.  **Update Guard**: Modify `cross-edit-guard.ts` (or relevant security tool) to BLOCK `edit()` calls where:
    - Target is `agent.json` (or `*/agent.json`).
    - Even if the target is the *current* agent's config.
2.  **Exception**: Only `May` (Level 1) or `Tech-Lead` (Level 2) may edit agent configs. `Bob` (Architect) may draft, but typically delegates.
    - Standard agents (Scout, Coder, Evaluator) must **NEVER** have write access to `*.json` files in `agents/`.

Please implement this block immediately.
