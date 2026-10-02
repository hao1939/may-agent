# Agent Directory Convention

**Supports:** [Agent Cooperation](../2a-design/agents.md). Explains how role guidance, tools and current context actually reach a worker.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

## Directory Layout

```
agents/<name>/
  agent.json              # Required. Operational config: model, tools, limits.
  AGENTS.md               # Required. Identity and stable operating contract.
  heartbeat.md            # Historical convention; loaded only by an explicit App consumer.
  cron.json               # Optional. Cron job definitions (top-level JSON array).
                          # Requires `"cron"` in agent.json tools[]; otherwise ignored.

  knowledge/              # On-demand reference material.
    INDEX.md              # Routing table for references.
    *.md                  # Domain docs, playbooks, long-form knowledge.

  workspace/              # Scratch/runtime work, not system prompt.
    *.md

  skills/                 # Reusable situational procedures.
    <name>/SKILL.md        # Canonical package; not always loaded.
    <name>/references/     # Optional progressive-disclosure detail.
    <name>/scripts/        # Optional; prefer TypeScript/JavaScript + Bun.

  tools/<capability>.ts   # Optional default-exported local tool factory.
  handlers/               # JS cron/event handlers.
  workflows/              # Executable TypeScript orchestration.
    <name>.ts              # Canonical flat workflow entrypoint.
  last-session.md         # Generated runtime memory, not system prompt.

projects/<id>.app/agents/<name>/
  agent.json              # Same shape; agent is scoped to the App.
  AGENTS.md
  skills/<name>/SKILL.md
  tools/<capability>.ts   # Same local tool convention.
  workspace/

shared/
  common-sense.md         # Shared always-loaded behavioral fundamentals.
  knowledge/              # Shared references, read on demand.
  skills/<name>/SKILL.md  # Fleet-wide reusable procedures.

projects/may-agent.app/docs/
  ...                     # May and Host architecture, design, and operator docs.
```

## Prompt Files

Two App/installation guidance files are loaded by convention. The Host also
bundles its short `src/lib/execution-instructions.md` with the binary:

| File                      | Purpose                                                         | Loaded                |
| ------------------------- | --------------------------------------------------------------- | --------------------- |
| `shared/common-sense.md`  | Shared behavioral fundamentals and repo conventions             | Every agent session   |
| `agents/<name>/AGENTS.md` | Agent identity, responsibility, constraints, escalation posture | That agent's sessions |

Everything else is discoverable context. `context.md`, `DOMAIN.md`, `TOOLS.md`,
`LESSONS.md`, `knowledge/INDEX.md`, `heartbeat.md`, `last-session.md`, and
`workspace/*` are not automatically loaded into the system prompt. Link useful
files from `AGENTS.md`, a scoped skill, or the Task's exact references so the
agent can read them when relevant. If particular bytes are required for a
judgment, the owning workflow supplies them in the task brief or uses the
existing `contextPreparation` hook. A configured path is not evidence that its
contents reached the model.

Agent definitions no longer declare `context_files`; older JSON containing it
remains readable, without injecting those files. Separately, an `agents` tool
call can supply `context_files` as explicit paths for its recipient to read.
These links are supporting context, not another instruction tier.

Canonical skills live in named directories with `SKILL.md`; loose Markdown
files under `skills/` are legacy. Native metadata discovery, bounded catalogs,
and per-turn invocation are implemented as specified in
[skills.md](../2a-design/skills.md). Callers may explicitly select one primary
skill, while model-driven activation is evidenced by a successful full-file
read.

Skills and workflows share scoped discovery conventions but not execution.
Skills are interpreted per-turn guidance; workflow TypeScript controls one
bounded ordered run. Durable waits end that run and resume through a later
event. See [workflows.md](../2a-design/workflows.md).

## What Goes Where

| Content                                            | Location                 | Reason                      |
| -------------------------------------------------- | ------------------------ | --------------------------- |
| "I am Bob, the system architect"                   | `AGENTS.md`              | Stable identity             |
| "Own architecture tradeoffs and escalation briefs" | `AGENTS.md`              | Durable responsibility      |
| "Use evidence before changing evaluation criteria" | `AGENTS.md`              | Always-on constraint        |
| "Long metric debugging recipe"                     | `knowledge/*.md`         | Situational reference       |
| "Read X when handling Y"                           | `knowledge/INDEX.md`     | Discovery routing           |
| "Use this procedure when task X appears"           | `skills/<name>/SKILL.md` | Situational reusable method |
| Periodic review method                            | App-owned skill/workflow | Selected by ordinary App input; no special heartbeat loader |
| Recent notes, drafts, temporary plans              | `workspace/`             | Runtime scratch             |
| Generated session continuity                       | `last-session.md`        | Runtime/session context     |

If a lesson must affect every session, promote the distilled invariant into
`AGENTS.md`. If it is situational, keep it in `knowledge/` and
link it from `knowledge/INDEX.md`.

### Reporting is not adoption

`finish()` reports the current turn. Its `completed_items` and `new_items` do
not complete or create Tasks/Requests; use the owning App's authorized controls.
`context_updates` reports suggestions, not an activated preference. The legacy
context-writing subscriber is retired, and even a written
`context.md` is not automatically included in a normal prompt. `lessons` attempts
a best-effort local memory-stream append, not automatic retrieval or learning.

For lasting behavior, use an authorized source edit in the owning guidance,
verify activation, then check a later relevant execution. A saved report or
file alone does not prove May will use it. Follow the existing
[learning review boundary](../2a-design/practice-learning-loop.md) and the
[scoped teaching proposal](../proposals/agent-behavior-and-capability-extension.md);
this does not grant permission to change live guidance. See
[skill snapshots](../2a-design/skills.md#discovery-lifecycle) for when an updated
definition takes effect.

Distinguish released references from mutable operational evidence. A knowledge
file inside a definition release stays with that snapshot; a live fact changes
when its tool reads the current owned source. Keep source/freshness clear.
Restart restores the active definition, not unactivated edits. Temporary input
or a selected skill may remain in history without becoming standing guidance.
The [method matrix](../archive/reviews/extension-methods-poc-20260912.md)
explains the selection, activation and retention tradeoffs.

## AGENTS.md Shape

Keep `AGENTS.md` concise and durable:

```markdown
# AGENTS — <Name>

## Identity

Who this agent is.

## Responsibility

What this agent owns and is accountable for.

## Operating Model

How it approaches work.

## Delegation and Escalation

Who it should involve and when.

## Constraints

Stable rules that must apply every session.

## References

Pointers to knowledge files, not copied knowledge.
```

`AGENTS.md` is also the pi-coding-agent-compatible file name. Running pi from
inside an agent directory can pick up that agent's instructions without May
needing a May-specific identity filename.

## System Prompt Assembly

This section describes the current managed execution path. See
[Model context assembly](../2a-design/agents.md#model-context-assembly) for
ownership and known gaps. The final provider input has three parts:
`systemPrompt`, `tools`, and `messages`; inspecting one prompt file is insufficient.

`resolveSystemPrompt()` in `projects/may-agent/src/lib/agent-execution.ts` builds:

1. `shared/common-sense.md`
2. the registered agent's `AGENTS.md` (global or app-local)
3. bounded skill metadata when the toolset can read skill files
4. generated runtime facts: project root, agent directory, workspace,
   knowledge path, and available tools

If `systemPrompt` is set directly on `SubagentDefinition`, convention-file
assembly, the skill catalog, and generated environment are bypassed. The bundled
Host execution instructions, execution references and required-completion
instructions are still appended. That escape hatch is for tests and special runtime sessions, not normal agent
configuration. Missing/empty convention files are currently skipped by the
prompt reader; a successful session is not proof that its role file was loaded.

The request and tool paths are separate:

1. A Task adapter supplies assignment/events and a Conversation adapter supplies
   bounded conversation data. Result semantics live in their SDK schemas.
   Workflow/helper calls supply their particular contribution. The manager adds
   Task discovery references and an exact managed-session assignment link.
2. For bounded executions, an explicit `contextPreparation` receives the full
   supplied request. Otherwise preparation uses the optional shorter
   `contextPrompt`, or the full request. The full and shorter forms are
   alternatives, not two unconditional copies in the model input.
3. An explicitly selected skill wraps the prepared request. Ordinary skill
   discovery contributes metadata, not every skill body. See
   [skill invocation](../2a-design/skills.md).
4. Tools are resolved for this execution. A required result schema becomes
   part of the `finish` tool definition, independently of request prose.
5. Before each managed model request, the loop compacts older messages when
   needed, then appends fresh observations and the Task decision brief when
   applicable. The provider receives that view alongside the system prompt and
   tool schemas.
   Tool results, steering and recovery messages can change subsequent requests.

`TASK.md` and its neighboring files provide attempt-start discovery. The Task
decision brief is a refreshed view; the transcript is execution history. A
generated file or a path in the prompt does not prove the model read its content.
Inspect omission/freshness markers and follow the exact references.

Compatibility persistent chat bypasses App request preparation. It adds a
generic conversation instruction and refreshes its state packet as message data
on every request; human text and source observations are not system instructions.
Native CLI workers and the Codex Task executor construct their own packets; they do not automatically inherit
the managed per-request transform. Their supplied packet and the CLI's own
instruction discovery must be checked separately.

For source review, follow `managed-agent.ts` or `conversations/turn-agent.ts`
into `manager.runDefinition`, `prepareAgentExecution`, and the runner's
`transformContext`/`streamFn` boundary. Inspect the actual system text, message
view and tool schemas there. Definition/session metadata, transcripts and Task
detail artifacts provide useful evidence, but are not an exact capture of every
provider request. The [dated review](../archive/reviews/agent-prompt-assembly-review-20260927.md)
contains the complete source map, baseline contradictions and implementation evidence.

### How to extend

Start with the smallest existing extension point:

1. **Change judgment:** edit the owning agent's `AGENTS.md` for durable policy,
   or add a skill for a situational method. Link longer knowledge. May's intent
   interpretation and communication style belong here.
2. **Add an action:** put a default-exported tool factory in the App agent's
   `tools/<capability>.ts`. The existing loader discovers these modules; the
   factory returns a named tool with `description`, `parameters` and `execute`.
   Describe effects, authority, errors and returned evidence beside the tool.
   `agent.json.tools` selects existing Host presets; local tool names do not
   need new presets or an `AppDefinition.tools` field. Use Host capabilities
   for Task state and delivery.
3. **Add a procedure:** compose available actions in an App workflow using the
   [workflow authoring contract](workflow-authoring.md). Give each agent call a
   specific contribution and result schema. Sharing a Task does not give every
   helper the whole Task assignment.
4. **Shape a large request:** optionally set `contextPreparation` in `agent.json`
   to a relative module inside that agent directory. Default-export an
   `AgentContextPreparer` from `@may-agent/sdk`: `(input: { task: string }) => string`.
   It receives the full supplied request, returns a nonempty brief synchronously,
   preserves requirements and references, and returns unsupported formats intact.
   Keep it pure and cheap; it is neither retrieval nor transcript management.

For the tool convention, follow Host `src/app/loader/agent-local-tools.ts` and
`toolset-loader.ts`. Factories receive `projectRoot`, `agentRoot` and `persistDir`;
these are execution services/locations, not a separate App state lifecycle.
The loader imports only immediate `.ts`/`.js` modules, skipping test and type
files. Keep support code in a subdirectory. Inspect activation notices: malformed
or failed factories are currently reported and skipped. Successful activation
and the actual prepared toolset, not file presence alone, establish availability.

The Host adds its execution instructions after resolving App system guidance.
It binds actual tools and the caller's output schema, then prepares the provider
message view. An App preparer cannot replace those surfaces through its return
value. Purity is an authoring contract, not isolation from trusted module code.
A new workflow or App needs no new global prompt category or lifecycle.

In a bounded managed session, `execution_context` links the existing session
`meta.json`; its `task` field retains the original full assignment even when the
App projects a shorter brief. Treat it as original scope, then apply current
accepted Task input and authorized steering. An explicitly selected skill's
canonical reference remains in the system context. Keep this reference beside
the particular invocation; a helper uses its own assignment, not its caller's.
Direct execution has no manager-owned session file; supply any needed exact
references in its execution context. Persistent chat does not pin the first
turn's assignment or skill as the purpose of all later turns.

A bounded execution's timestamp is labeled **Environment captured at**. It is
stable during that prepared execution (manager-created executions share the
manager startup time), not a promise of current wall-clock time on each turn.

### Verify and activate separately

Inspect all three provider surfaces: `systemPrompt`, tool definitions, and
transformed messages. A regression can use production `prepareAgentExecution`
and `createAgentRun` with only `streamFn` replaced by a fixture provider. Exercise
App preparation, compaction, current-state refresh and rejected results. Validate
required source content as well as its path. The existing manager retains
compaction snapshots; the ordinary transcript is history, not an exact provider
request or proof of semantic coverage.

Source tests establish mechanics. Use paired model trials through Gym before
claiming better judgment or cheaper execution. Keep assignment, model, tools
and evidence comparable; include successful work, failure recovery, independent
waits, helper scope and corrections. Check real outcomes, repeated effects and
lost obligations, not just whether the prompt is shorter.

App guidance/tool/skill edits need their reviewed definition release activated.
Host assembly changes need the reviewed binary/SDK rolled out. In-flight
executions retain their captured definitions. Reporting `context_updates`,
editing a source file, passing CI and activating an App are separate facts.
For the prompt cleanup, integrate May's companion guidance before activating
the Host change; it remains compatible with the previous Host. No data migration
is needed. See the [implementation record](../archive/reviews/agent-prompt-assembly-review-20260927.md#implementation-and-verification).

## agent.json

`agent.json` is operational only:

```jsonc
{
  "name": "dev",
  "description": "Investigates runtime failures and returns verified fixes",
  "domain": "may-agent implementation",
  "model": "claude-opus-5",
  "tools": ["coding", "agents", "finish"],
  "compaction": true,
}
```

Do not put prose instructions in `agent.json`.
`memoryLimit` is a retained compatibility field with no effect on current
system-prompt assembly; omit it from new configurations.

Omit retired `context_files` and `skillActivationRules` configuration. Link
supporting context from identity, skills or Task references; skill selection
uses the catalog and explicit `skill` argument.

Skills are convention-discovered rather than enumerated in `agent.json`.
Operational enable/disable policy may be added later without moving skill
instructions into configuration.

## Adding a New Agent

1. Create `agents/<name>/agent.json`.
2. Create `agents/<name>/AGENTS.md`.
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`,
   `skills/<name>/SKILL.md`, handlers, or workflows.
4. Restart or use the runtime reload command.

For an Agent-App-scoped agent, use the same shape under
`projects/<id>.app/agents/<name>/`. Wire project-specific automation from the
app's `app.ts` schedules and workflow handlers, not from a separate
project-local cron file. Use this for project-specific automation, not shared
platform policy.

## Common Mistakes

- **Prompt bloat:** Put long methodology in `knowledge/`, not `AGENTS.md`.
- **Hidden auto-load assumptions:** Files are not prompt just because they are uppercase.
- **Lessons as a dump:** Distill durable lessons before promoting them into `AGENTS.md`.
- **Workspace as memory:** `workspace/` is scratch. Curated knowledge belongs in `knowledge/`.
