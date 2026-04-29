# Skill: Agent Growth Cycle (Package Prototype)

**Version**: 1.1.0
**Type**: Workflow / Meta-Skill

## Description
The standard mechanism for safely evolving agents. It replaces "editing live agents" with a rigorous **Fork → Train → Verify → Promote** workflow.

## Principle
**P51 The Growth Cycle**: Evolution requires isolation. Never practice on production.

## Interface
This skill provides the following tools:
- `fork_agent(source: string, target: string)`: Create an isolated clone.
- `verify_agent(agent: string, task: string)`: Run a task to prove the agent works.
- `promote_agent(source: string, target: string)`: Apply changes to production.
- `discard_agent(agent: string)`: Clean up the experiment.

## Protocol
1. **Identify**: Formulate a hypothesis (e.g., "If I add X to Coder, it will stop doing Y").
2. **Fork**: `call("coach", "fork_agent('coder', 'coder-v2')")`
3. **Train**: Edit `agents/.lab/coder-v2/SOUL.md`.
4. **Verify**: `call("coach", "verify_agent('coder-v2', 'Fix the bug...')")`
   - **Must** generate a PASS/FAIL signal.
   - **Must** confirm behavioral change.
5. **Promote**: `call("coach", "promote_agent('coder-v2', 'coder')")`
   - Overwrites config/knowledge, preserves identity/workspace.
   - Deletes the fork.
6. **Discard**: `call("coach", "discard_agent('coder-v2')")` (if failed).

## Package Structure
```
prototype-skill-package/
├── README.md          # Skill prompt (what agents read)
├── tools/             # Tool definitions (.ts.example — illustrative, not compiled)
├── tests/             # Skill tests (.ts.example — illustrative, not compiled)
└── examples/          # Usage examples
```

> **Note**: `.ts` files are renamed to `.ts.example` to prevent vitest from
> picking them up as test targets. In a real skill package with integrated
> tooling, these would be proper `.ts` files resolved via the project's
> module system.

## Constraints
- **Never edit live agents** for behavioral changes.
- **Verification is mandatory**.
- **Clean up**. Always promote or discard.
