# Analysis: Common Sense Infrastructure (2026-03-17)

## Evidence
- `read(agents/bob/workspace/brief-infra-finish-tool.md)`: Designed `finish()` tool.
- `read(agents/bob/workspace/brief-infra-stuck-detection.md)`: Designed Stuck Detection.
- `read(agents/bob/workspace/brief-infra-opbudget.md)`: Designed OpBudget Visibility.
- `read(agents/bob/workspace/brief-infra-tool-injection.md)`: Designed Tool Name Injection.
- `agents.send(tech-lead)`: Delegated all 4 briefs to Tech-Lead.
- `read(agents/shared/common-sense.md)`: Updated with pending status for all 4 items.

## Analysis
We have launched a significant infrastructure wave to automate "Common Sense":
1.  **Completion**: Agents will structurally signal success/failure via `finish()`, replacing unstructured text.
2.  **Stuckness**: The system will detect and interrupt death spirals via `detectStuckState()`.
3.  **Resources**: Agents will see their remaining budget via context injection, preventing hard stops.
4.  **Tools**: Agents will know exactly what tools are available via context injection, eliminating hallucinations.

This shifts the burden from "Coach must train agents" to "Infra enforces behavior." This is the correct evolution (P155 Infra Dominance).

## Actions Taken
- Designed and delegated 4 infrastructure mechanisms.
- Updated `common-sense.md` to reflect the shift from "Behavioral" to "Infra (Pending)".
- Handed off philosophy updates (Law 118, DPIR) and security fixes (P13/P108) to May.
