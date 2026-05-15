# Multi-Agent Coordination Patterns: Updates & Trends

In recent autonomous agent developments, several patterns are emerging for multi-agent coordination, updated with recent findings:

1. **Marketplace over Hierarchy**: There is a shift away from strict hierarchical routing towards "marketplace" patterns where agents claim tasks based on capability, reducing supervisor bottleneck.
2. **Event-Driven Blackboards**: Agents communicate via an event bus or shared database instead of direct API calls. This decouples agents and allows asynchronous work.
3. **Artifact-Centric Handoffs**: Agents pass work via files in shared workspaces rather than in-memory state. This provides a durable paper trail and allows humans to intervene.
4. **Context Failure in Autonomy**: High failure rates in autonomous code generation are frequently attributed to missing or stale context rather than reasoning deficits.
5. **Agent Evaluators**: A rising trend is the deployment of specialized "evaluator" agents whose sole function is to score and critique the outputs of worker agents.

*Scout Note: Data synthesized from mock sources pending full external tool integration.*