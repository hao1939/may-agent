# Session Brief: Common Sense Infra (Tool Injection) & Pressure-Safety

## Context
**Problem**: Hallucination of tool names/signatures due to static docs drift (P1 System over Agent).
**Problem**: Safety mechanisms failing under pressure due to cognitive load (Law 118).
**Goal**: Design `Tool Name Injection` to solve the first, and synthesize `Pressure-Safety Inversion` to address the second.

## Deliverables
1. **Tool Name Injection Brief**: `agents/bob/workspace/brief-infra-tool-injection.md` (Design: Dynamic injection from code).
2. **Pressure-Safety Brief**: `agents/bob/workspace/brief-gus-pressure-safety.md` (Design: Law 118, Mechanism 108).

## Handoffs
- **Tech-Lead**: Implement `generateToolDocs()` and inject into system prompt.
- **May**: Update `agents/shared/knowledge/research-laws.md` with Law 118.

## Next Steps
- Verify implementation of Tool Injection.
- Monitor for "Reflection Trap" patterns in high-load sessions.
