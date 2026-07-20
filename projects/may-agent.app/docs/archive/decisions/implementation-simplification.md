# Proposal: Explicit and Auditable Agent Execution

**Status:** Accepted and implemented.
**Implementation status:** Shared execution, strict direct tool policy, Gym
denials/manifests, shared config parsing, and shared local-tool loading are
implemented. Hosted and direct definition construction now use one builder,
and deterministic preparation-parity coverage verifies prompt, model, tool
names, skill catalog, guards, finish policy, compaction policy, timestamp, and
context paths.
**Scope:** Make every direct or Gym run explicit about which configured tools
the environment denies and which tools the agent actually receives.

## Review Decision

Approve this proposal if the following rule is correct:

```text
agent configuration
+ explicit environment denials
= effective agent definition
-> shared prepare/run
-> result + execution manifest
```

The environment may restrict an agent, especially in Gym, but it must not do so
silently. A configured tool that is neither explicitly denied nor constructible
is an error.

This proposal does not require direct and hosted environments to provide the
same external services. It requires differences to be intentional, visible,
and reviewable.

## Simple Mental Model

```text
Agent.run(effective definition, input) -> result

Gym
  = Agent.run
  + scenario-owned tool denials
  + isolated evidence recording

Daemon
  = Agent.run
  + hosted tools
  + sessions, events, tasks, schedules, recovery, and interfaces
```

Agent execution does not know whether its caller is Gym or the daemon. It
receives a fully prepared definition containing the exact model, prompt inputs,
skills, guards, and tools available for that run.

## Current State

The important execution boundary is already implemented:

- `agent-runner.ts` wraps the model/tool loop without autonomous
  infrastructure.
- `agent-execution.ts` prepares prompt hierarchy, skills, guards, finish
  behavior, compaction, and model configuration.
- `SubagentManager` uses that shared preparation and adds durable session and
  event behavior around it.
- Gym invokes `runDirectAgent()` instead of the hosted `--oneshot` path.
- The Gym adapter records an isolated transcript and result without creating
  EventBus, SQLite, task controllers, schedules, or recovery.

Direct agent assembly now uses the shared pure config reader, shared validation,
and shared local-tool loader. Its capability rule is explicit:

```text
configured tools - caller denials = effective tools
```

May declares:

```text
coding, query_db, agents, message, cron, cli-delegation, system-status, finish
```

Gym explicitly denies production database, dispatch, messaging, scheduling,
checkpoint, delegation, workflow, and system-status capabilities when they are
configured. Every direct result stores the configured, denied, and effective
sets, and Gym includes that manifest in the trial result and prints the compact
counts/restrictions. An effective tool without a direct implementation fails
before generation.

Given the same effective definition and environment inputs, hosted and direct
preparation now produce the same prompt, skills, guards, model, finish policy,
compaction policy, context paths, and tool names. The parity test fixes both the
session identity and prompt timestamp so differences cannot be hidden by
volatile prompt data.

## Required Contract

### Configured tools

`agent.json.tools` is the agent's declared tool set. Direct and hosted callers
must use the same parser and validation rules to read it.

### Explicit denials

A caller may deny configured tools. Each denial names the tool and a plain
reason:

```ts
type ToolDenial = {
  name: string;
  reason: string;
};
```

Examples:

- `message`: proposal-only scenario must not notify real users;
- `cron`: benchmark must not change autonomous schedules;
- `cli-delegation`: judgment test evaluates the proposal, not execution;
- `query_db`: isolated fixture does not expose the production database.

Denials are ordinary run input, not a named profile or hidden direct-mode
allowlist.

### Effective tools

The effective tools are exactly:

```text
configured tools - explicitly denied tools
```

Every effective tool must be constructed successfully. If its required service
is unavailable, preparation fails with a clear error. There is no third
“missing but silently allowed” state.

### Execution manifest

Every direct and Gym result records one compact manifest:

```json
{
  "agent": "may",
  "configuredTools": ["coding", "agents", "message", "finish"],
  "deniedTools": [
    { "name": "message", "reason": "proposal-only benchmark" }
  ],
  "effectiveTools": ["coding", "agents", "finish"]
}
```

The arrays use stable configuration order. The manifest describes the run; it
does not introduce another lifecycle or persistence system.

## What Must Be Shared

Direct and hosted execution share:

- agent-directory resolution;
- `agent.json` parsing and validation;
- model resolution and validation;
- agent, knowledge, and workspace path rules;
- skill discovery rules;
- prompt, guard, finish, and compaction preparation; and
- the low-level factory used for any tool available in both environments.

Refactor the existing config reader so its core returns data or diagnostics
without EventBus. The daemon may publish those diagnostics afterward; Gym
records them with the trial.

Local tool modules remain part of tool construction, not definition loading.
They use one loading and validation helper in both environments.

Do not require one giant tool builder with every possible optional service.
Hosted and direct callers may assemble tools differently because their
environments differ. When both construct the same tool, they call the same
tool factory.

## Gym Behavior

Tool restrictions belong to the benchmark or scenario.

The May alignment benchmark is a judgment test: May writes a structured
proposal and must not perform the proposed work. Its benchmark definition
should explicitly deny tools that would perform autonomous or external work.
The effective set must still contain the tools needed to inspect the fixture
and write the decision artifact.

The Vitest-style report should show a short tool line for every trial:

```text
tools: configured 7, denied 4, effective 3
denied: message, cron, cli-delegation, system-status
```

The full denial reasons remain in the trial artifact. A human should not need
to inspect a transcript to discover that the harness changed the agent.

Capability tests that need a broader tool surface may declare fewer denials.
Adding direct implementations for supporting-agent calls or workflows is a
separate milestone; until then, a scenario must explicitly deny those tools or
the run fails before generation.

## Persistence Boundary

The shared execution core returns messages, result, and neutral observations;
it does not persist them.

```text
executePreparedAgent -> result and observations
Gym adapter          -> isolated benchmark artifacts
SubagentManager      -> durable session files and system projections
```

Direct or Gym recording is allowed and necessary for evaluation. The invariant
is that recording remains outside the model/tool loop.

## Minimal Implementation Plan

### Step 1 — Add the execution manifest and strict rule (implemented)

- Add explicit tool denials to `runDirectAgent()` input.
- Compute configured, denied, and effective tools.
- Reject unknown denial names.
- Fail if any effective tool cannot be constructed.
- Replace `unavailableCapabilities` with the execution manifest.
- Delete `DIRECT_CAPABILITIES` as an implicit policy.

**Completion evidence:** no configured tool disappears without a recorded
denial.

### Step 2 — Reuse config and local-tool loading (implemented)

- Extract pure config parsing from the current hosted loader.
- Use the same parser and `validateAgentConfig()` in direct and hosted paths.
- Use one local-tool module loader and validator.
- Keep EventBus reporting in the daemon caller.

**Completion evidence:** `readAgentConfig()` and `loadDirectLocalTools()` no
longer exist.

### Step 3 — Declare Gym restrictions (implemented)

- Add tool denials to the May alignment benchmark definition.
- Pass them to the direct runner.
- Persist the execution manifest with every trial.
- Show configured, denied, and effective tools in the human report.

**Completion evidence:** the report explains every difference between May's
configured and effective tool sets.

### Step 4 — Add preparation parity tests

For the same agent, timestamp, effective tools, and model environment, compare
direct and hosted preparation:

- identity and paths;
- model configuration;
- skill catalog;
- effective tool names;
- system prompt;
- guards; and
- finish policy.

The test holds environment input constant. It does not pretend a restricted
Gym scenario and a fully hosted daemon have identical tools.

**Completion evidence:** any unexplained direct/hosted preparation difference
fails the test.

## Acceptance Criteria

1. Direct execution never silently removes a configured tool.
2. An unresolved effective tool fails before model generation.
3. Unknown or duplicate denials fail validation.
4. Every Gym trial records configured, denied, and effective tools.
5. The May alignment report shows its tool restrictions without opening trial
   artifacts.
6. Direct and hosted callers use the same config parser and validation rules.
7. Local tool modules use the same loading and validation helper.
8. Given identical effective inputs, direct and hosted preparation produces the
   same model, prompt, skills, tools, guards, and finish policy.
9. The execution core retains no EventBus, SQLite, task, schedule, HTTP, or
   daemon dependency.
10. Existing daemon sessions and autonomous task reconciliation remain
    unchanged.

## Explicit Non-Goals

- No Agent App loader or manifest redesign.
- No app or agent renaming.
- No daemon or `installProjectApps()` redesign.
- No task-tree, reconciler, database, or session-storage change.
- No SDK reorganization.
- No universal service container or top-level tool registry.
- No runtime profiles or `standalone` flag.
- No requirement that Gym expose production infrastructure.
- No direct supporting-agent or workflow implementation in this change.
- No broad workflow-engine rewrite.

## Review Questions

1. Is `configured - denied = effective` the complete tool policy needed here?
2. Should an unresolved effective tool always fail before generation?
3. Are benchmark-owned denial reasons sufficient for human audit?
4. Does deferring direct supporting-agent and workflow execution keep this
   change appropriately small?
5. Is any additional field truly necessary in the execution manifest?
