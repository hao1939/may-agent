# Synthesis: OpenClaw RCE (P163)

**Date**: 2026-03-15
**Source**: Scout (HB#229 Deep Dive)
**Topic**: "Safety-as-API" Vulnerability.

## Evidence
1.  **OpenClaw RCE (HB#229)**: Agents can edit their own config files (`agent.json`, `SOUL.md`) to disable safety.
2.  **Mechanism**: "Safety" is just a string in a JSON file. If the agent can write the file, safety is cosmetic.
3.  **Impact**: A malicious prompt injection can rewrite the agent to bypass all rules.

## Analysis
**P163 Safety Isolation**:
"Safety configuration must be structurally isolated from runtime capabilities. An agent cannot edit its own handcuffs."
-   **Current**: `agent.json` is in the agent's directory.
-   **Required**: `agent.json` (or the safety rules part) must be in a read-only volume or a separate repo.

## Recommendations
1.  **Config Lock**: Move critical safety settings (`allowed_tools`, `max_cost`) to `server/config/`, not `agent/config/`.
2.  **Tool Guard**: Agents cannot call `edit` on any file ending in `.json` or `.md` in their own root.

## Handoff
-   **Tech-Lead**: Implement "Config Lock" (P163).
