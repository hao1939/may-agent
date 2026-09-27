# Skill Discovery And Invocation

**Design status:** Accepted.
**Implementation status:** Implemented for scoped discovery, bounded catalogs,
explicit/model activation, delegation, new-session reload snapshots, and trace
evidence. Existing execution sessions retain their selected definition; reload
does not refresh them in place. Effectiveness evaluation by content hash remains
follow-up work.

## Purpose

A skill is reusable, task-specific guidance that helps an agent apply a known
method without making that method part of its permanent identity.

Skills are context resources, not work records:

- an event carries admitted input or a fact;
- a session performs bounded or conversational work;
- a workflow enforces repeatable orchestration;
- a guard observes or intervenes on mechanical risk;
- a skill supplies situational instructions for one turn.

One-turn scope is not an erasure guarantee: the selected body and its results
can remain in conversation history. Do not mistake transcript carryover for a
new skill read, renewed activation, or a saved standing preference.

Skill loading must not create a parallel request lifecycle or its own success
state machine. The enclosing request correlates a bounded turn; an App Task owns durable
work. Workflow and session records remain execution evidence.

## Skill And Workflow Boundary

Skills and workflows share a few authoring conventions, not an execution
architecture. Both have scoped ownership, names, descriptions, validation,
reload behavior, and trace evidence. Their loaders and controllers remain
separate.

Their controllers remain different:

| Concern        | Skill                   | Workflow                     |
| -------------- | ----------------------- | ---------------------------- |
| Primary source | `SKILL.md` instructions | TypeScript module            |
| Controller     | Model judgment          | Workflow runtime             |
| Unit of use    | One model turn          | One bounded workflow attempt |
| Sequencing     | Advisory                | Enforced by code             |
| Closure        | Enclosing session/work  | Workflow terminal result     |

A bundled skill script is an optional deterministic helper; the model still
decides whether and how to run it through normal tools. It does not make the
skill executable orchestration. A workflow may call an agent with a skill for
one judgment-heavy step, while the workflow continues to own sequencing and
the terminal result.

## Design Decision

Reuse the installed `@earendil-works/pi-agent-core` skill utilities:

- `loadSourcedSkills()` for discovery, parsing, source attribution, and
  diagnostics;
- `formatSkillsForSystemPrompt()` for the model-visible metadata catalog;
- `formatSkillInvocation()` for explicit per-turn invocation;
- `NodeExecutionEnv` for filesystem access.

Do not migrate the Host's session manager from the low-level `Agent` to
`AgentHarness` merely to gain skills. The Host already owns session
persistence, event bridging, compaction policy, queued turns, delegation, and
trace closure. Reuse the small skill primitives inside the existing manager.

Import these helpers from the package's public `@earendil-works/pi-agent-core`
and `/node` exports, not from `dist/`. Pin and compatibility-test the Earendil
package version because this harness surface is not assumed to exist in every
pi-agent distribution.

## Package Contract

The canonical package is:

```text
<skill-name>/
  SKILL.md
  references/       # optional; read only when needed
  scripts/          # optional; prefer TypeScript/JavaScript and Bun
  assets/           # optional output resources
  agents/openai.yaml # optional Codex/UI metadata; ignored by May v1
```

`SKILL.md` starts with:

```yaml
---
name: verify-change
description: Verify a code or configuration change with targeted evidence before completion is claimed.
---
```

Rules:

- `name` and `description` are required.
- The directory and `name` use the same lowercase hyphenated value.
- Names are at most 64 characters.
- Descriptions state both capability and trigger conditions and are at most
  1,024 characters.
- Keep the body concise and imperative. Put detailed variants in direct
  `references/` files.
- A discovered directory containing `SKILL.md` is one skill boundary; nested
  references are not additional skills.
- Loose Markdown files directly under `skills/` are legacy documents, not
  canonical skills. Migrate them into named directories or exclude them from
  discovery.
- Discovery never executes scripts. Scripts run only through the agent's
  existing tools, permissions, and guards.
- Bundled scripts do not own retries, durable state, or completion. Promote a
  stable, evidence-backed sequence to a TypeScript workflow instead.

May v1 reads the standard `name`, `description`, body, and path. It preserves
optional cross-client metadata but does not depend on `agents/openai.yaml`.

## Scope And Precedence

Use the existing scope conventions:

| Priority | Scope                  | Location                                                  |
| -------: | ---------------------- | --------------------------------------------------------- |
|        1 | Owning app-local agent | `projects/<id>.app/agents/<agent>/skills/<name>/SKILL.md` |
|        2 | Owning global agent    | `agents/<agent>/skills/<name>/SKILL.md`                   |
|        3 | Shared fleet skill     | `shared/skills/<name>/SKILL.md`                           |

An app-local agent may overlay a same-named global-agent skill; a global-agent
skill may in turn overlay a shared skill. The closest valid definition wins.
Skills never merge.

Duplicate names within one scope are invalid. Discovery returns a diagnostic
and omits the ambiguous name rather than selecting by filesystem order.
`loadSourcedSkills()` preserves source metadata; the Host defines and applies
the precedence policy.

Symlinks may expose one canonical package to another client, but discovery
must validate the canonical target against trusted skill roots. Do not maintain
copied, independently edited variants.

## Discovery Lifecycle

Discover skills when agents are registered and when the runtime reloads agent
configuration:

```text
agent directory + shared root
  -> loadSourcedSkills()
  -> validate and resolve precedence
  -> agent skill catalog
  -> compact metadata in new-session system prompts
```

Missing roots are empty, not errors. Invalid packages appear in the reload
result and use the existing `agent.config_invalid` operational path with an
`errors` entry whose `field` is `"skills"`; they are not model-visible.

New executions prepared from the registry use the latest activated definition.
An already prepared execution or persistent chat retains its selected definition:
both the metadata in its system prompt and later explicit activation use that
session's catalog. A reload must not mix new skill bodies into an old definition
or mutate context during a provider call. An explicit caller-supplied definition
also remains pinned rather than silently following the registry.

Starting a fresh execution can adopt the activated definition without replacing
the enclosing Conversation or Task. Do not confuse a human-facing conversation
with one model execution session; persistent-session callers must prepare a new
execution to adopt a new catalog. This is a snapshot boundary, not a promise of
live prompt refresh.

## Progressive Disclosure

Normal system prompts retain their current hierarchy:

```text
shared/common-sense.md
agent AGENTS.md
available skill metadata
generated runtime facts
```

The catalog contains only `name`, `description`, and canonical location. Full
skill bodies do not enter every prompt. Skills remain subordinate to system
safety, shared principles, and the owning agent's `AGENTS.md`.

Use `formatSkillsForSystemPrompt()` as the base representation, with a May
budget wrapper:

- use at most 2% of the model context window when known;
- otherwise cap the catalog at 8,000 characters;
- shorten descriptions before omitting skills;
- retain closer-scope skills before shared skills;
- report omissions in runtime diagnostics.

Only expose model-invocable catalog entries when the session has a read-capable
tool. Programmatic explicit invocation remains available without a read tool
because the runtime inserts the selected body directly.

An omitted skill can still exist in the loaded catalog. A model with only a
file-read tool may have no usable way to locate it from runtime diagnostics.
Use concise scoped descriptions and an accessible exact reference or supported
explicit selection where needed; do not assume omission is harmless. The
[method PoC](../proposals/extension-methods-poc-20260912.md#delivery-and-natural-use)
reproduces this boundary and its limits. Catalog visibility, full-body delivery,
method use and useful outcome are separate evidence.

## Invocation

### Model-selected

The catalog tells the model to read the complete `SKILL.md` when the task
matches its description. The model performs the judgment; v1 does not add a
second semantic classifier.

A successful read of a cataloged `SKILL.md` loads the skill for that turn.
Relative references resolve against the skill directory and remain subject to
normal path permissions.

### Human invocation and entry-path limits

Direct-agent input recognizes a leading selector:

```text
$verify-change review and verify the current patch
```

May Console and Telegram publish one human `conversation.message.created` on
`Conversation may:primary`; Host admission derives one fenced May App request.
Their wrapped request does not currently forward the selector as explicit
skill activation. The model may interpret the request and read the skill, but
the prefix alone is not proof that it loaded. Use the actual skill-read evidence.
Explicit direct-agent input may instead start or steer a named execution
session. The selected skill is bounded owner/execution context; it is never
another request or ownership record.

### Explicit runtime and delegation invocation

Add an optional skill name to existing session boundaries:

```ts
manager.run(agent, task, { skill: "verify-change", trace });
manager.send(sessionId, task, { skill: "verify-change", trace });

agents({ action: "call", agent, task, skill: "verify-change" });
agents({ action: "fork", agent, task, skill: "verify-change" });
```

The manager validates the name against the receiving agent's catalog and uses
`formatSkillInvocation()` to combine the full skill body with the task. A
turn has at most one explicit primary skill in v1. Other cataloged skills can
still be read on demand.

The `agents` tool's `context_files` argument appends explicit file references
to the recipient's assignment; it does not inject their contents. A known skill
should use the typed `skill` field so validation, provenance, and evaluation
remain reliable. The retired agent-definition field with the same name has no
prompt effect; see [prompt files](../2b-manual/agent-convention.md#prompt-files).

## Trace And Evaluation

Skill use is evidence inside the existing turn trace:

```text
human/project/workflow intent
  -> skill.loaded
  -> session work and tools
  -> session.idle/session.end
  -> existing delivery or owner result
```

`skill.loaded` is an unpaired evidence event, not a lifecycle opener. It
contains:

```ts
type SkillLoadedData = {
  name: string;
  agent: string;
  sessionId: string;
  activation: "explicit" | "model" | "rule";
  scope: "app-agent" | "agent" | "shared";
  filePath: string;
  contentHash: string;
};
```

It inherits the current turn trace. Session evaluation consumes the evidence
to compare outcomes with and without a skill. There is no `skill.completed`:
the session terminal event already records the outcome, and effectiveness is a
derived evaluation question rather than a success claim by the skill.

Do not emit an event merely because metadata appeared in a catalog. Emit
`skill.loaded` only when the full body actually entered model context.

## Safety And Trust

- Treat skill content as task guidance below system and agent identity
  instructions.
- Reject packages whose canonical path escapes trusted roots unless explicitly
  installed as a trusted external skill.
- Cap the full body admitted by explicit invocation; the initial limit is 64
  KiB before provider-token checks.
- Do not execute bundled scripts during discovery or activation.
- Run scripts through existing tools, guards, sandboxing, and approval paths.
- Preserve current cross-agent edit ownership. A skill does not grant authority
  to edit another agent or project.
- Record the content hash so later evaluation identifies the exact revision.

## Codex Interoperability

May skill packages should remain compatible with the open skill shape used by
Codex: one `SKILL.md`, optional resources, and no May-specific copy of the
body. Expose the canonical directory to Codex through a supported repository or
user skill location, preferably by symlink.

The May Host and Codex may differ in discovery roots and optional metadata. The
package is shared; each runtime owns its catalog and invocation policy. Verify
actual CLI discovery rather than treating the existence of a symlink as proof
that a worker loaded the skill.

## Boundaries

Use a skill when judgment should follow a reusable method. Promote it when
stronger execution is justified:

| Need                                                 | Mechanism                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Situational method or domain procedure               | Skill                                                                      |
| Deterministic multi-step sequencing                  | Workflow                                                                   |
| Mechanical observation or intervention               | Guard                                                                      |
| Capability an agent calls against an external system | Tool                                                                       |
| Repeated typed automation entering an existing App   | Discoverable App action that validates and admits one correlated App input |
| Ordinary project-directed request                    | Project comment/intent handled by the App                                  |
| Recurring/event-driven wake-up                       | Schedule or handler                                                        |
| Cross-owner decision or action                       | Escalation                                                                 |

Do not encode project state, task ownership, retries, approvals, or completion
inside a skill. Durable work and acceptance remain with the App Task; the Host supplies
scheduling and recovery.

Promote a skill into a workflow only when repeated evidence shows that
sequencing should be consistent, terminal conditions can be explicit, and
runtime enforcement is safer than model choice. Frequency alone is not enough:
a schedule may invoke a skill-bearing session without turning the skill into a
workflow. See [`workflows.md`](workflows.md#promotion-heuristic).

## Current Implementation And Remaining Work

May currently discovers scoped packages during agent load/reload, resolves
precedence and diagnostics, inserts a bounded catalog into eligible session
prompts, supports explicit and model-selected activation, and emits
trace-aligned `skill.loaded` evidence. Invalid packages and untrusted symlinks
are omitted with diagnostics.

Two boundaries matter:

- Persistent chats retain their prepared catalog. This is the intentional
  definition-snapshot rule, not failed reload. A fresh execution adopts the
  activated catalog without replacing the human Conversation or Task.
- `skill.loaded` records exact content identity. A stable outcome/regression
  comparison by skill hash needs separate Evaluation design and evidence;
  recording the hash alone does not supply that comparison.

Improve these paths in place. Skill activation must continue to use the same
agent runtime and must not create another work lifecycle.

## Acceptance Criteria

- Valid canonical skills are discovered at their expected scope.
- Invalid or ambiguous skills are omitted with actionable diagnostics.
- The normal prompt contains metadata but not full skill bodies.
- Explicit invocation inserts exactly one selected body plus the task.
- Model-selected loading requires a successful full-file read.
- Agent and shared name collisions resolve deterministically.
- Reload never mutates a running turn; new sessions receive the new catalog.
- `skill.loaded` shares the enclosing turn trace and creates no lifecycle pair.
- Existing session terminal evidence remains the only turn closure.
- Skill scripts use TypeScript/JavaScript and Bun unless an existing required
  tool has no maintained equivalent.
- Tests cover discovery, precedence, prompt budget, explicit invocation, and
  symlink trust. Persistent-chat refresh and end-to-end trace evaluation need
  dedicated follow-up coverage.
