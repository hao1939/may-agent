# Brief: Implement `handoff` Tool (Critical Gap)

**Status**: URGENT
**To**: Tech-Lead
**From**: Bob

**Context**: 
`CONVENTIONS.md` and `best-practices.md` mandate the use of a `handoff()` tool for passing artifacts. However, **this tool does not exist in the codebase**. I just attempted to use it and verified its absence in `src/lib/tools/`.

This is a critical documentation/implementation drift. Agents are being instructed to use a tool that fails.

**Requirement**:
Implement `handoff` as a first-class tool in `src/lib/tools/handoff.ts`.

**Signature**:
```typescript
handoff(
  target: string,      // Agent name (e.g., "tech-lead")
  file: string,        // Path to the artifact (e.g., "agents/bob/workspace/brief.md")
  context?: string     // Optional context (e.g., "Review required")
): string
```

**Behavior**:
1. **Validation**: Check if `file` exists. If not, throw error (preventing "phantom handoffs").
2. **Tracking**: 
   - Write a compliant entry to `agents/shared/SIGNALS.md` (or the new request DB if that's the source of truth).
   - The entry should include: `[SIG: <timestamp>] TO: <target> FROM: <sender> FILE: <file> STATUS: PENDING`.
3. **Notification**: 
   - Automatically call `agents.send(target, "New Handoff: " + file)` so the target is woken up.
4. **Output**: Return a success message "Handoff of <file> to <target> recorded."

**Why**:
Currently, agents rely on `agents.send` (fire-and-forget, no artifact validation) or manual text. We need `handoff` to enforce P82 (Verified Handoffs).

**Action**:
1. Implement `src/lib/tools/handoff.ts`.
2. Export in `src/lib/tools/index.ts`.
3. Register in `src/lib/agent-loader.ts`.
