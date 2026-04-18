# Infrastructure Dominance & Tool Injection Briefs

## Evidence
- **Scout's Analysis**: `agents/scout/workspace/cr223-agent-serving-stack-workflow-infrastructure.md`
- **Common Sense Gap**: "Know your tools" (P38) - agents try to use tools that don't exist or use wrong arguments.
- **Law 115 (Infrastructure Dominance)**: Infrastructure choices (serving stack, tool harness) determine reliability more than model capability.
- **Principle 128 (Cache-Coordination Coupling)**: Workflow scheduling and cache lifecycle must be jointly optimized.

## Analysis
### Law 115: Infrastructure Dominance
The "Agent Serving Stack" (Orla + RelayCaching) proves that **infrastructure dictates performance**.
- **Prediction**: Without workflow-level cache management, multi-agent systems hit an O(M²) cost wall.
- **Action**: We must move from "Chat-Based Handoffs" to "State-Based Workflows" where context is preserved/cached structurally, not just re-read.

### Common Sense Gap: Tool Injection
Agents frequently hallucinate tools or arguments because `TOOLS.md` is static and often stale.
- **Fix**: The system should **auto-inject** the *actual* list of available tools (names + signatures) into the system prompt at runtime.
- **Mechanism**: `AgentLoader` reads `tools/` directory -> generates JSON schema -> injects into `system_prompt`.
- **Benefit**: 100% accuracy on tool availability. Zero hallucination of missing tools.

## Plan
1. **Define Law 115**: Update `philosophy.md` via brief to May.
2. **Design Tool Injection**: Write `brief-infra-tool-injection.md` for Tech-Lead.
3. **Verify Handoffs**: Ensure `brief-gus-infrastructure-dominance.md` and `brief-infra-tool-injection.md` are properly recorded in `SIGNALS.md`.

## Deliverables
- `brief-gus-infrastructure-dominance.md` (Already in sent/)
- `brief-infra-tool-injection.md` (Already in sent/)
- `analysis-phantom-write.md` (Completed)

## Next Steps
- Brief Tech-Lead on `brief-infra-tool-injection.md` implementation.
- Brief May on `brief-gus-infrastructure-dominance.md` philosophy update.
