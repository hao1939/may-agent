# Workflow business/Host boundary: current owners

**Supports:** [Workflow Discovery And Execution](../2a-design/workflows.md). Keep procedure authoring separate from Host management and historical migration plans.

**Design status:** Integrated into the owning contracts.
**Implementation status:** The SDK workflow kernel and standalone entry points exist. Full agent-runtime parity remains partial; sharing a workflow kernel does not prove identical agent tools, context or lifecycle. No deployment claim is made here.

Use the current owners:

- [Workflows](../2a-design/workflows.md): module contract, scope, effects and procedure freedom.
- [Shared Agent Runtime](../2a-design/agent-runtime.md): one agent execution in standalone and Host.
- [SDK](../2a-design/sdk.md#standalone-execution-and-testing): current callable testing and standalone APIs.
- [Workflow authoring](../2b-manual/workflow-authoring.md#testing): practical examples and fixture use.
- [Implementation convergence](unified-agent-instance-runtime.md): remaining runtime work.

The [original extraction proposal](../archive/workflow-business-host-boundary.md)
preserves the framework comparison, intermediate interfaces, migration steps and
verification rationale. Those historical examples are not current APIs.

## 2. Three execution modes over one Host-free kernel (unblocking Gym)

This heading preserves an earlier published link. Fixture tests, standalone/Gym
and Host bind services to the shared workflow kernel. Use the current
[SDK testing/standalone guide](../2a-design/sdk.md#standalone-execution-and-testing)
and [authoring manual](../2b-manual/workflow-authoring.md#testing), not the retired
`ctx.agents`, `ctx.workflows` or separate workflow-tool examples in the archive.
