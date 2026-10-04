# Durable Tasks for agents without an App

**Supports:** [Task ownership and App scope](../2a-design/agents.md#task-ownership-and-app-scope).
An agent should carry useful work across interruptions without requiring an App
package solely to acquire a Task address. Apps remain useful extensions of their
owner agents, organizing scope, knowledge, capabilities and collaborators.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first),
[one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource)
and [agents judge; infra executes](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
Reuse the existing Task, request, Condition and recovery contracts. Optional
organization should not require another execution lifecycle.

**Design status:** Agent ownership and optional App membership are accepted.
The admission and compatibility details below need implementation review.
**Implementation status:** Not implemented. This is the next change after
clarifying current ownership, discovery, context and escalation. Global agents
can run bounded calls today; durable Tasks still require App admission.

## Intended behavior

A caller can request durable work from an agent directly or use an App address
for that owner's scoped service. The direct request has one responsible agent.
An App request retains the App's scope, policy and knowledge and normally
selects its owner agent; declared assignment rules can select a specialist.
The source obligation and any destination contribution remain separate Tasks.

Both paths use the same admission, execution, accepted-result and return
contracts. A caller may declare a Condition when it needs the result. A pending
Condition does not prevent useful independent work. An agent can use bounded
helpers and workflows without turning every contribution into another Task.

The Host handles identities, delivery, scheduling and recovery. Agents specify
the work and judge progress; they do not invent internal routing scopes or write
an App wrapper for an ordinary standalone assignment.

## Implementation work to review

1. **Admission and addressing.** Add an explicit agent destination to the existing
   durable request boundary. Define the minimal direct input and its validation.
   Keep App schemas authoritative for App-addressed work and preserve idempotent
   request identity. Do not expose a second inbox or use a notification as a Task.
2. **Identity and assignment.** Retain a stable Task identity independent of
   execution sessions. Decide how the existing App-keyed records and reads
   represent an optional App without changing saved request links. Review when
   inherited assignments become fixed and how an authorized reassignment occurs.
3. **Execution context and authority.** Supply the owner's capabilities, workspace,
   knowledge and creator reference for a direct Task. Keep helper scope and
   existing permission checks. App context is added when selected, not required
   for agent identity. No agent name or membership grants privileges.
4. **Recovery and escalation.** Use the existing restart and caller-feedback
   path. A standalone owner has no App escalation step; installation policy
   supplies its available help route. Preserve the original Task when help is
   requested. Do not claim automatic human escalation from guidance alone.

These are changes to existing contracts, not four new subsystems. Do not choose
a storage migration or public schema merely to make an early example look
complete. Keep legacy App addresses working while reviewing direct admission.

## Evidence required

Use a fixture with a registered global agent and no App definition. Submit one
durable request, retry admission, interrupt execution, restart and verify the
same Task resumes with its owner and accepted work intact. Return its result to
the exact caller Condition. Verify rejection of unknown agents and unauthorized
assignment changes without losing accepted work.

Also exercise an App owner and a different specialist: App input must preserve
scope and context, select the declared agent, and return specialist help to the
original obligation. A bounded helper must not become the Task owner. Retain
workflow/native execution without requiring an extra model judgment on every
attempt. Report source checks separately from actual-agent behavior and deployment.
