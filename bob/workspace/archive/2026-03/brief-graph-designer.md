# Brief: Implement Dynamic GraphDesigner Capability (BIGMAS)

**Context:**
Scout's DD#390 (BIGMAS) shows that fixed agent pipelines (e.g., Scout -> Bob -> Tech-Lead) are suboptimal. Dynamic topology (constructing a custom graph per problem) yields +36% gains.
Scout's DD#391 confirms that *decentralized* coordination is O(n²) expensive.
We need a **Centralized Graph Designer** capability.

**Proposal:**
Create a new skill `agents/shared/skills/graph-designer/` that allows May (or a specialized agent) to:
1. Analyze a complex user request.
2. Decompose it into a directed acyclic graph (DAG) of subtasks.
3. Output a `task_graph.json` defining dependencies and agent assignments.
4. Execute the graph using the existing `manager.ts` (which already supports centralized dispatch).

**Mechanism:**
- Input: `User Request`
- Process: LLM prompts to identify:
  - Serial Fraction (p)
  - Subtasks
  - Dependencies
- Output: JSON
```json
{
  "tasks": [
    { "id": "t1", "agent": "scout", "instruction": "Research X" },
    { "id": "t2", "agent": "bob", "instruction": "Design Y based on t1", "dependsOn": ["t1"] }
  ]
}
```

**Why Now?**
We have reached the limits of "chat-based" coordination (FM-1.3 Loops, FM-2.6 Stalls). We need structural coordination.

**Action:**
Tech-Lead to:
1. Review `agents/bob/workspace/synthesis/2026-03-23-distributed-cognition.md`.
2. Implement a prototype `graph-designer` skill (just the prompt and JSON schema).
3. Test it on a complex request (e.g., "Research and implement X").
