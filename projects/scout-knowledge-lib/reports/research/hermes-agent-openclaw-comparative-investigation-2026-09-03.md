<ai_context>
summary: "Pinned-source comparison of NousResearch Hermes Agent and official OpenClaw. Reconciles 28 existing Scout leads, explains both operating models, checks representative memory and command-safety behavior, audits current failures, and derives adoption guidance for Scout, Herdr Supervisor, and durable autonomous agents."
triggers: ["Hermes Agent", "OpenClaw", "Hermes vs OpenClaw", "agent learning loop", "Skill Workshop", "long-running agent recovery"]
last_updated: "2026-09-03"
source_basis: "Direct inspection of official repositories pinned on 2026-09-02, current official releases and documentation, six issue records, 28 existing Scout lead rows, two bounded networkless Hermes component reproductions, and explicit non-reproduction limits. Upstream performance and incident reports remain attributed."
</ai_context>

# Hermes Agent and OpenClaw — Comparative Investigation

## What was wrong and what changes

Scout's earlier material could not support a current comparison. It contained
27 Xiaohongshu cards whose technical content was unavailable, a repository
identity row, duplicate claims that Hermes v0.18 was a total rewrite, and an
older picture of OpenClaw as flat Markdown memory without native subagents or a
learning loop. Some notes also mixed the official projects with third-party
projects such as `hermes-self-evolution`, OpenClaw-RL, and EvoMap.

The current primary sources change that picture:

- **Hermes is a broad personal-agent runtime whose distinctive default is an
  aggressive, direct-write review loop.** Its Python ReAct loop, gateway,
  profiles, cron, persistent sessions, subagents, plugins, memory, and skills
  are substantial. The background reviewer is enabled by default, inherits
  the live runtime, runs up to 16 model/tool iterations with a default aggregate
  input budget of 600,000 tokens, and is prompted that most sessions should
  produce a skill update. Memory and skill approval gates exist, but both are
  opt-in.
- **OpenClaw is now a stateful agent control plane, not merely a chat bot around
  Markdown files.** A long-lived WebSocket Gateway owns routing, sessions,
  agents, channels, device nodes, writer claims, recovery, and a layered memory
  system. Its Skill Workshop is a real learning loop based on pending proposals,
  immutable generations, hashes, scanning, staleness checks, and rollback
  metadata. Automatic review can update Workshop-owned state, while autonomous
  review keeps human-authored skills read-only.
- **Neither project proves general self-improvement.** Both implement durable
  adaptation machinery; neither supplies a controlled longitudinal comparison
  showing that enabling it improves held-out tasks without regressions or an
  unacceptable cost increase. Successful writes are mechanism evidence, not
  capability evidence.
- **The useful contrast is governance, not “learning versus no learning.”**
  Hermes optimizes for a short path from experience to mutation. OpenClaw
  optimizes for typed state, review, staleness detection, and recovery. Hermes
  is easier to understand locally; OpenClaw makes more failure states explicit
  but pays for that in code, schema, operational, and migration complexity.

The practical conclusion for Scout and Herdr is to borrow OpenClaw's proposal
and revision machinery, Hermes' hard catastrophic-command floor and compact
curated memory, and neither project's pressure to generate persistent changes
without held-out evidence.

## Scope and evidence contract

This is a finite snapshot, not product monitoring. Project identity, default
branch, pinned revision, and latest release were verified against the two
official GitHub repositories on 2026-09-03.

| Project | Official identity | Pinned `main` revision | Commit time | Latest release checked |
|---|---|---|---|---|
| Hermes Agent | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | [`1cb3ab617363ffab9e55239a7d2ab0d6f9c10473`](https://github.com/NousResearch/hermes-agent/commit/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473) | 2026-09-02 10:43:27 -07:00 | [`v2026.8.31`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.31), product 0.21.0 |
| OpenClaw | [openclaw/openclaw](https://github.com/openclaw/openclaw) | [`1212f991db46ad4ffe8c11198c175a5736392a15`](https://github.com/openclaw/openclaw/commit/1212f991db46ad4ffe8c11198c175a5736392a15) | 2026-09-02 10:57:05 -07:00 | [`v2026.8.2`](https://github.com/openclaw/openclaw/releases/tag/v2026.8.2) |

Claims use four evidence classes:

| Class | Meaning in this report |
|---|---|
| Direct | Pinned source was inspected or a bounded local path was executed. |
| Upstream-documented | Official project documentation or a release says it; the behavior was not independently exercised. |
| Upstream-reported | An issue reporter describes an incident; it is not accepted as fact unless the pinned source also confirms the mechanism. |
| Analysis | A comparison or recommendation derived here from the preceding evidence. |

No credentials were given to either project. No upstream code was executed with
network access, secrets, a writable clone, or broad host access. Stars,
popularity, release volume, and secondary titles are not treated as capability
evidence.

The directly relevant comparative paper, [“Dive into Claude Code”
`2604.14228v2`](https://arxiv.org/abs/2604.14228v2), is useful for its boundary-
architecture framing and older three-system snapshot. It is not current proof:
both repositories have since added or changed material memory, learning,
recovery, and authority paths. The stronger controls for this comparison are
therefore the pinned implementations and a simpler architecture—one model/tool
loop, bounded curated memory, pending proposals, external held-out evaluation,
and operator activation. No official controlled longitudinal paper showing
that either current learning loop beats that control was found.

## Existing lead inventory and disposition

The existing [self-evolution lead ledger](./agent-self-evolution-lead-ledger-2026-09-01.tsv)
contains exactly 28 matching rows: eight Hermes Xiaohongshu cards, nineteen
OpenClaw Xiaohongshu cards, and one Hermes repository-metadata row. All 27 cards
are `metadata-only`: their titles are useful questions, but none supplies a
technical body that can prove its claim. The rows below account for every one.

| Question cluster | Existing lead identities and title claims | Disposition after primary inspection |
|---|---|---|
| Architecture and “reset” | Hermes `6a463ed2…` “v0.18 complete reset”; `6a341c7f…` “Hermes and OpenClaw abandoned?”; OpenClaw `6996ec21…` “only undisclosed file”; `698989a2…` architecture/memory dissection; `69cd0fe1…` Claude Code comparison | The “abandoned” and hidden-file implications remain unsupported title rhetoric. The reset claim is contradicted by Hermes' official [`v2026.7.1`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.1) release, which calls v0.18 the “Judgment Release,” a P0/P1 backlog clean sweep plus incremental features—not a clean-room architecture. Current architecture is resolved below. |
| Memory | Hermes `69d9196b…`; OpenClaw `69b11087…`, `6998185c…`, `699aacbf…`, `6990870b…` | Deduplicated into one question: storage, admission, recall, consolidation, deletion, and authority. The older “OpenClaw has a flat-memory crisis” frame is superseded by current primary sources. Claims that a named third-party memory layer fixes efficiency remain unverified. |
| Skills, self-improvement, and RL | Hermes `69df0f65…` “built-in RL framework,” `69e270a9…` autonomous evolution, `69dba445…` skills + GEPA; OpenClaw `69a97059…`, `699d68d5…` EvoMap, `699d47ad…` tool creation, `69874b0a…`, `69833c74…`; plus `code:hermes-agent` | Hermes has a direct skill-review loop; that is not weight training, and no built-in RL training result was found. OpenClaw has Skill Workshop, but EvoMap and OpenClaw-RL are separate projects. Skill-list titles are ecosystem discovery only. Both projects demonstrate mutation machinery, not held-out improvement. |
| Multi-agent and Kanban | Hermes `6a28b73b…`, `69f9a0df…`; OpenClaw `6995bb17…` | Native delegation/subagents are verified in both. Hermes also has a Kanban surface; OpenClaw has agent routing and native subagents. A UI metaphor or agent count does not establish coordination quality, conflict safety, or throughput. |
| Reliability and long tasks | OpenClaw `69b5bffc…` “four keys to stability,” `69a6c4fc…` long complex tasks, `69946c21…` post-install use | Titles remain anecdotal. Current primary sources establish explicit persistence and recovery machinery, while current issue evidence also shows stale-writer, delivery, transcript-growth, and memory-migration failure modes. |
| Cost and token claims | OpenClaw `69909297…` “save 90% token” | Rejected as an unverified percentage. Both systems expose cost-reduction mechanisms and can also add background-model cost. Neither pinned project supplies a controlled 90% comparison applicable to Scout or Herdr. |
| Tools, alternatives, and compatibility | OpenClaw `699454a4…` lightweight replacement, `6986a54c…` stronger search | Retained only as product-discovery leads. They do not answer the two-project capability question and no body or stable comparison protocol was available. |

Several Scout notes need explicit reconciliation:

- [`2026-07-26-github-hermes-self-evolution-constitutional-loops.md`](../../knowledge/findings/2026-07-26-github-hermes-self-evolution-constitutional-loops.md)
  describes the third-party `hermes-self-evolution`, not Hermes Agent core.
- [`2026-07-05-xhs-scan-67.md`](../../knowledge/findings/2026-07-05-xhs-scan-67.md)
  and [`2026-07-07-xhs-scan-72.md`](../../knowledge/findings/2026-07-07-xhs-scan-72.md)
  repeat the unsupported “complete reset” reading.
- [`2026-07-22-xhs-direct-scan-51.md`](../../knowledge/findings/2026-07-22-xhs-direct-scan-51.md)
  preserves useful practitioner frustration, but its OpenClaw memory frame no
  longer describes the current implementation.
- The Niuma/OpenClaw “140K lines, 633 commits, about 3% failure” claim in
  [`xhs-chinese-ai-trends-june2026.md`](../../knowledge/findings/xhs-chinese-ai-trends-june2026.md)
  remains a practitioner report, not official OpenClaw measurement.
- OpenClaw-RL, EvoMap, and third-party memory plugins must remain separate from
  official OpenClaw behavior unless an integration is inspected explicitly.

This disposition stops at the correct boundary: absent card bodies cannot be
reverse-engineered from titles, while every material project claim now has a
current primary-source path.

## How Hermes Agent actually works

### Loop and task model

Hermes' core is a Python `AIAgent` tool loop. It assembles a system prompt and
conversation, calls a configured model, executes returned tool calls, appends
results, and repeats while its iteration budget permits. The same runtime is
adapted to a terminal interface, messaging Gateway, one-shot jobs, cron,
profiles, and delegated child sessions. Tool batches may be segmented and run
concurrently where the dispatcher considers that safe. This is recognizable
ReAct architecture; the product work is in the surrounding tool registry,
state, policies, providers, surfaces, and recovery paths rather than a novel
reasoning loop. [Direct: `conversation_loop.py`](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/agent/conversation_loop.py)

The Gateway multiplexes external adapters onto agent sessions. Profiles scope
configuration and state. Cron can create recurring or one-shot work; Kanban and
messaging integrations are additional scheduling and interaction surfaces, not
different reasoning architectures.

### Memory

Hermes combines two forms of persistence:

1. **Curated prompt memory:** `MEMORY.md` stores agent notes and `USER.md`
   stores a user model. Defaults are deliberately small—2,200 and 1,375
   characters—and their contents enter the system prompt on a later load.
2. **Session memory:** SQLite stores conversations and an FTS5 full-text index
   supports past-session search and model-assisted summarization.

The agent receives periodic memory nudges; the default interval is 10 user
turns. Writes are scanned for prompt injection, credential-exfiltration, SSH
backdoor, and invisible-Unicode patterns and rejected above the configured
limits. `memory.write_approval: true` stages writes, but the documented default
is `false`, so ordinary and background-review writes land directly. [Direct:
memory documentation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/memory.md)

This is simple, legible semantic memory plus richer transcript retrieval. Its
strength is that the curated core remains inspectable and bounded. Its limit is
that correctness, provenance, conflict handling, and promotion quality depend
heavily on model judgment; a scanner and size cap do not prove a memory is true
or useful.

### Skills and adaptation

Hermes' strongest distinctive mechanism is the automatic background review.
After a turn, the runtime may fork an `AIAgent`, replay either the conversation
snapshot or a routed digest, and grant only memory and skill-management tools.
The fork inherits the parent's runtime and credentials unless separately
routed. It is enabled by default; configuration-read or interpretation errors
leave it enabled—explicit fail-open behavior. [Direct: `background_review.py`](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/agent/background_review.py)

Important operating details are not visible in the marketing sentence:

- maximum review loop: 16 iterations;
- default aggregate review input budget: 600,000 tokens, with non-positive
  configuration disabling the cap;
- memory review cadence: 10 user turns by default;
- skill-review consideration: after roughly 10 model/tool iterations by
  default;
- review prompt: “ACTIVE — most sessions produce at least one skill update,”
  which creates a mutation prior even when abstention would be safer;
- direct writes are the default; `skills.write_approval` and
  `memory.write_approval` are separate opt-in staging gates.

The mechanism is not wholly ungoverned. It requires read-before-write, protects
bundled/hub/pinned/user-owned skills from background mutation, bounds skill
content, scans created material, records usage, can notify the user, and can
stage changes. These are meaningful controls. The missing control is empirical
admission: there is no required paired regression or held-out task showing the
new skill performs better than the old one. A model believing a write is useful
is not an evaluator independent of that write.

The README's unqualified claim that Hermes is “the only agent with a built-in
learning loop” is false against current official OpenClaw. [Direct: Hermes
README](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/README.md)

### Tools, subagents, and multi-agent operation

Hermes exposes filesystem, terminal, browser, web, messaging, code, MCP,
memory, skill, delegation, cron, and plugin-defined capabilities depending on
profile and surface. Native `delegate_task` children can run foreground or
background work with bounded iteration defaults and completion delivery.
Kanban adds a human-visible coordination surface. These features verify native
subagents and multi-agent scheduling, but do not by themselves establish
conflict-free shared-state coordination or superior task performance. [Direct:
delegation documentation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/delegation.md)

### Long-running execution, recovery, and observability

Hermes persists more than chat history. Current paths cover process
checkpoints, SQLite session state, FTS index handling, active sessions, pending
message spools, cron execution records and incidents, gateway health, and
session export/recovery. SQLite failures can be quarantined or retried rather
than silently reused, and FTS can detach from the core transcript path. These
are credible recovery mechanisms, but the breadth of independent caches,
spools, profiles, adapters, and process registries makes recovery an
operationally complex reconciliation problem. [Direct: session lifecycle](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/docs/session-lifecycle.md)

Logs, session inspection, exports, gateway status, cron incidents, review
summaries, and optional approval queues provide useful visibility. No reviewed
artifact gave a controlled end-to-end recovery rate or cost distribution.

### Human control and authority boundary

Hermes has an always-on hard floor for catastrophic shell patterns, plus
smart/manual/off approval postures, a configurable write-safe root, optional
isolated terminal backends, whole-process container/OpenShell options, and
sender allowlists on external adapters. This is a useful layered posture.

The project's security policy is unusually clear that only operating-system
isolation is a boundary against an adversarial model. Approval classifiers,
output redaction, Skills Guard, and tool allowlists inside the Python process
are heuristics. The default terminal backend runs with the operator's OS
authority; plugins and loaded Python execute in-process; terminal-backend
isolation does not automatically contain every code/MCP/plugin path. Network
adapters require allowlists, but authorized callers inside one adapter share a
trust level. [Direct: security policy](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/SECURITY.md)

## How OpenClaw actually works

### Gateway, agents, and task loop

OpenClaw centers one long-lived WebSocket Gateway that owns channel
connections, routing, Gateway RPC, session stores, agent configuration,
device-node coordination, and control-plane events. Each agent has a workspace,
auth/profile state, skills snapshot, and session namespace. The embedded agent
loop performs intake, context assembly, model inference, tool execution,
streaming, and persistence. Runs serialize per session and optionally through a
global lane. [Direct: agent loop](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/agent-loop.md)

The most useful durability detail is writer ownership. An admitted run records
`activeWriterRunId`; transcript appends and rewrites carry an expected writer
ID, and the synchronous database transaction rechecks that claim. A superseded
writer therefore should not commit stale transcript state. A state-directory
lock prevents a second Gateway or local process from owning the same store.
This is stronger than queueing alone because it fences stale work at commit.

### Memory

Calling OpenClaw “flat Markdown memory” is now inaccurate. Its current memory
architecture includes:

- curated `MEMORY.md` and `USER.md`, daily notes, transcripts, and optional
  wiki/plugin stores;
- origin classes and session-kind gates that determine what may be promoted or
  automatically recalled;
- vector and keyword hybrid recall, recency/importance ranking, maximal
  marginal relevance, and deterministic trigger recall;
- Active Memory, which can escalate eligible turns to a bounded deep-recall
  subagent lane;
- project-scoped memory and standing intents, with intents stored separately in
  SQLite as prospective “when X occurs, do Y” state;
- dreaming phases that ingest eligible interactive transcripts, consolidate
  candidates, write human-readable diaries, and keep cron, heartbeat, subagent,
  and unknown sessions out of automatic durable-candidate ingestion;
- admission policy, provenance-aware promotion, and `memory forget` deletion
  workflows, with documented limits for older or untracked memories.

The design separates curated facts, episodic material, retrieval indexes,
prospective intent, and human-readable review. That separation is valuable.
It also creates many coupled policy, index, provenance, migration, and
background-job states. More layers do not prove better recall; the issue
evidence below shows how migration and ranking state can fail operationally.
[Direct: memory architecture](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/memory-architecture.md)

### Skill Workshop and adaptation

OpenClaw's Skill Workshop is an official governed learning loop. `/learn` and
other collection paths create pending proposals. The system retains immutable
generations and revision hashes, records target hashes to detect changes since
review, scans content before application, and keeps rollback/pre-image
metadata. The lifecycle separates proposal, review, application, staleness,
rejection, and rollback rather than treating a write as proof of success.
[Direct: Skill Workshop](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/tools/skill-workshop.md)

Autonomous mode can apply Workshop-owned updates and a scheduled weekly
collection review can reconcile accumulated evidence. Human-authored skills
remain read-only to autonomous review. This is materially more governed than
Hermes' default direct periodic review. It is also much heavier: SQLite state,
generations, hashes, proposal limits, scanning, ownership classes, scheduling,
and rollback paths all have to remain mutually consistent.

The governance establishes reviewability and reversibility, not efficacy.
Neither the documentation nor pinned tests provide a held-out campaign proving
that Workshop-enabled agents outperform a no-Workshop control. OpenClaw's
learning claim is therefore stronger at the state-transition level than at the
capability-improvement level.

### Tools, subagents, and multi-agent operation

OpenClaw routes channels or accounts to configured agents with separate
workspaces, auth profiles, and session stores. It includes native subagent
spawning, depth and allowlist policies, completion announcement, agent-to-agent
controls, cron, heartbeats, hooks, MCP, browser/device tools, and trusted
in-process plugins. This refutes old Scout material implying there is no native
subagent facility. [Direct: subagent documentation](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/tools/subagents.md)

These separations are routing and operational isolation, not a hostile tenant
boundary. Workspaces are working directories, not containment. Plugins execute
inside the Gateway process. Independent agents can still share the OS identity,
host, Gateway, and configured resources.

### Long-running execution, recovery, and observability

OpenClaw documents automatic restart recovery for admitted main-session runs,
subagents, and background work; bounded retries and tombstones; durable writer
claims; outbound delivery queues and receipts; completion announcements; and
session reconciliation after Gateway restart. Terminal process state is not
magically restored—the recovery system reconciles durable intent and recorded
effects. [Upstream-documented: restart recovery](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/restart-recovery.md)

The runtime emits assistant, tool, and lifecycle streams and supports trace,
verbose, status, audit-ledger, usage, compaction, doctor, and security-audit
surfaces. The metadata-only audit projection avoids copying prompt bodies while
recording lifecycle and result codes. Writer claims and explicit terminal
states give Herdr a more useful pattern than “process still exists.”

### Human control and authority boundary

OpenClaw provides DM pairing and allowlists, group policies, sender-scoped tool
controls, exec policies and approvals, workspace-only file settings, agent tool
profiles, device pairing, security audit/doctor commands, and optional
sandboxing. The default trusted-operator posture remains broad: sandbox mode is
off, host exec uses `security="full"` and `ask="off"`, and `host=auto` resolves
to the Gateway host when no sandbox is active. [Direct: security documentation](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/security/index.md)

The official trust model is one trusted operator or mutually trusting team per
Gateway. Sender controls and agent routing are defense in depth, not hostile
multi-user isolation. Mutually adversarial tenants require separate Gateways
and preferably separate OS users, virtual machines, or hosts. Native plugins
are trusted in-process code. [Direct: multi-tenant hosting](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/multi-tenant-hosting.md)

## Representative checks

### Hermes curated-memory write and reload

A networkless bubblewrap sandbox mounted the pinned Hermes clone read-only and
made only a temporary directory writable. A temporary memory store received a
normal memory write. The write succeeded, but the already-built system-prompt
snapshot did not change in place; a newly loaded `MemoryStore` included the
entry. A prompt-injection-like entry was rejected, and a write beyond the
configured character limit was rejected. The only created files were the
temporary `MEMORY.md` and its lock file.

This directly establishes four narrow facts: writes persist, prompt snapshots
are not magically refreshed mid-turn, the reviewed scanner rejects a
representative injection string, and the size limit is enforced. It does not
establish semantic truth, exhaustive scanner coverage, cross-process conflict
safety, or long-term retrieval quality.

### Hermes command classification

The command classifier was loaded in the same networkless, read-only-clone
sandbox:

| Input | Observed classification |
|---|---|
| `rm -rf /` | hardline blocked: recursive delete of root filesystem |
| `rm -rf ./build` | dangerous, not hardline |
| `curl … | sh` | dangerous: remote content piped to shell |
| `python -c …` | dangerous: script execution via `-e`/`-c` |
| `git status` | neither hardline nor dangerous |

This proves representative classifier branches, not that shell heuristics are
complete. Hermes' own security policy correctly rejects that interpretation.

### Why OpenClaw was not executed

The pinned OpenClaw clone has no `node_modules`. Node 22.19.0 and pnpm are
available, but installing the project's large dependency graph would expand
the trusted surface and was unnecessary for resolving the central source-level
claims. No OpenClaw runtime reproduction was therefore performed. Current
behavior is labeled direct source inspection or upstream documentation, never a
Scout execution result. This is the exact remaining validation limit.

## Failure and issue evidence

Issue bodies are upstream reports unless the pinned source independently
confirms their mechanism.

| Project / issue | Status observed | Evidence and conclusion |
|---|---|---|
| Hermes [`#75394`](https://github.com/NousResearch/hermes-agent/issues/75394) | open | Upstream report and audit describing stale background-review action replay, claim/disk desynchronization, and empty skill names. Relevant to direct mutation and concurrent review; not reproduced here. |
| Hermes [`#101351`](https://github.com/NousResearch/hermes-agent/issues/101351) | open, `needs-repro` | Alleged background-review credential persistence. Evidence is private and the report names a local-patches version, so the claim is not independently verifiable and is not treated as a confirmed vulnerability. |
| Hermes [`#90837`](https://github.com/NousResearch/hermes-agent/issues/90837) | closed, completed | Reporter describes 11 recurring `state.db` corruption incidents. Current recovery and quarantine code is consistent with subsequent hardening, but the incident count remains reporter evidence. |
| OpenClaw [`#135192`](https://github.com/openclaw/openclaw/issues/135192) | open, P1 | Reports stale writer claims, swallowed completion announcements, a faulty symlink migration, and silent ingress blockage after 2026.8.1. The report illustrates coupled recovery-state failures; the complete incident was not reproduced. |
| OpenClaw [`#136452`](https://github.com/openclaw/openclaw/issues/136452) | open, P0 | Reports heartbeat transcript growth and V8 out-of-memory failure. The impact is un-reproduced, but the root control flow is direct: [`runSessionCompactionIfNeeded`](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/src/auto-reply/reply/agent-runner-memory.ts) returns when `isHeartbeat` is true before resolving or checking `maxActiveTranscriptBytes`. The byte fuse therefore cannot fire on that path at the pinned revision. |
| OpenClaw [`#123361`](https://github.com/openclaw/openclaw/issues/123361) | open, P2 | Reports that dreaming recall became effectively frozen after migration. Pinned [promotion source](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/extensions/memory-core/src/short-term-promotion.ts) confirms frequency-weighted ranking, but the weeks-long production symptom and its migration cause require operator data and were not reproduced. |

The issue set does not support “project X is reliable and project Y is not.” It
shows different concentrations of risk: Hermes' fastest path creates mutation,
review, and SQLite consistency hazards; OpenClaw's richer state machine creates
writer-claim, migration, delivery, and background-maintenance interactions.

## One comparative rubric

| Dimension | Hermes Agent | OpenClaw | Evidence-backed judgment |
|---|---|---|---|
| Intended use | Personal, multi-surface AI agent that learns memory/skills and can run locally, remotely, or through messaging. | Personal or mutually trusted-team Gateway connecting agents, channels, workspaces, and device nodes. | Both are operator-controlled personal-agent platforms, not hostile multi-tenant services. OpenClaw is more explicitly a control plane. |
| Autonomy | Broad tools, cron, delegation, and default-on background review with direct writes. | Broad tools, cron, heartbeats, subagents, dreaming, standing intents, and optional autonomous Workshop review. | Hermes has the more aggressive default mutation loop; OpenClaw has more typed autonomous workflows. Neither proves general autonomous improvement. |
| Reliability | Bounded loop controls, session SQLite/FTS, spools, checkpoints, health, quarantine, and recovery paths. | Serialized session lanes, in-transaction writer fencing, explicit lifecycle, receipts, retries, tombstones, and restart reconciliation. | OpenClaw has the stronger explicit state protocol; its greater state complexity creates more coupled failure modes. No comparable reliability campaign was found. |
| Recoverability | Session/DB repair, quarantine, exports, process checkpoints, cron incidents, pending-message recovery. | Durable claims, delivery receipts, subagent/background recovery, bounded retries, tombstones, and migration/doctor paths. | Both treat recovery as reconciliation. OpenClaw more often models ownership and terminal state explicitly; Hermes is easier to inspect locally. |
| Observability | Logs, session search/export, status, review notices, approval queues, cron incident data. | Lifecycle/tool streams, trace/verbose/status, usage, audit ledger, doctor, security audit, proposal/generation state. | OpenClaw exposes more structured state. Hermes offers a smaller mental model. Neither report supplies end-to-end SLO evidence. |
| Security | Catastrophic-command hard floor, approval modes, write-safe root, sender allowlists, optional isolated backends/wrappers; default backend has operator OS authority. | Pairing/allowlists, tool/exec policies, file guards, audit, device controls, optional sandbox; default sandbox off and host exec broad. | Hermes' unconditional catastrophic floor is worth adopting. Both clearly require OS isolation for adversarial content; neither routing nor workspaces provide hostile isolation. |
| Cost | Main or auxiliary review can replay substantial context; default aggregate background-review input cap is 600K, and the feature fails open. | Recall, Active Memory, dreaming, Workshop, compaction, subagents, and retries can add calls; detailed usage surfaces exist. | No normalized cost comparison exists. “90% token saving” is unsupported. Default-on cost-incurring review should fail closed or abstain. |
| Extensibility | Python skills/plugins, MCP, providers, tools, surfaces, terminal backends. | TypeScript plugins/hooks, skills, MCP, providers, channels, device nodes, harness adapters. | Both are highly extensible and therefore supply-chain sensitive. OpenClaw's Gateway has the larger integration surface; Hermes is friendlier to direct Python extension. |
| Self-improvement evidence | Direct memory/skill mutation, periodic review, usage records, guards, optional staging. No held-out efficacy result. | Proposal/generation/apply/rollback loop, autonomous Workshop-owned maintenance, provenance. No held-out efficacy result. | OpenClaw proves the better-governed state transition; Hermes proves the shorter learning path. Neither proves retained capability improvement. |
| Operating tradeoff | Lower conceptual distance from model reflection to useful local change; higher mutation pressure and weaker default admission. | Stronger ownership, staleness, rollback, and recovery semantics; more schemas, jobs, migrations, and operational states. | Choose simplicity only with conservative writes; choose richer governance only when its states are observable and tested. |

## What is novel, conventional, strong, and weak

### Genuinely distinctive

- Hermes makes continuous memory/skill review a first-class product default and
  couples it tightly to the live agent runtime. The combination—not reflection
  itself—is distinctive and operationally consequential.
- OpenClaw treats agent learning and long-running operation as versioned state
  protocols: proposal generations, hashes, writer claims, provenance, receipts,
  tombstones, and separate intent state. Individual primitives are familiar;
  their breadth in one personal-agent Gateway is distinctive.
- OpenClaw's separation of prospective standing intent from retrospective prose
  memory is a particularly clean design decision.

### Conventional but useful

ReAct loops, Markdown bootstrap files, SQLite, FTS/vector retrieval, cron,
subagents, plugins, hooks, allowlists, approval prompts, and container sandboxes
are conventional. Their value comes from precise ownership and failure
semantics, not novelty labels.

### Strong evidence

Pinned code establishes the loops, defaults, guards, proposal machinery, state
transitions, writer checks, and the heartbeat early-return defect. The isolated
Hermes checks establish representative write, reload, rejection, size-limit,
and command-classification behavior.

### Weak evidence

Xiaohongshu titles, marketing superlatives, issue incident counts without
operator data, claims about abandoned projects or total rewrites, token-saving
percentages, and “self-improvement” inferred from successful writes are weak.
No reviewed source supplies a controlled longitudinal benchmark of either
project's learning loop.

## Recommendations for Scout, Herdr, and durable agents

### Adopt

1. **Proposal-first persistent mutation.** Model-generated memory, skill, or
   policy changes should be pending artifacts by default, separate from active
   state.
2. **Expected-revision and target hashes.** Reject or re-review a proposal when
   the target changed after observation; never replay a stale action merely
   because it once passed review.
3. **Provenance classes and single-writer ownership.** Bind every durable write
   to the source, actor, run, session kind, and expected active writer, and
   recheck inside the commit transaction.
4. **Pre-images, immutable event history, and explicit terminal states.** Make
   approval, rejection, application, supersession, rollback, and exhaustion
   independently inspectable.
5. **Durable claims, idempotency keys, and delivery receipts.** Recovery should
   reconcile accepted work and effects, not merely restart a process or replay
   a story.
6. **Separate prospective intent from prose memory.** A future condition and
   action need scope, expiry, fire budget, cooldown, and lifecycle—not a sentence
   buried in a summary.
7. **Hard catastrophic-command floors and bounded retries.** Some actions should
   remain blocked regardless of a softer approval mode; every automated retry
   path needs a terminal exhausted state.

### Experiment under a registered evaluation

1. Run background review only after evidence-rich, completed work, not every
   conversational interval.
2. Compare review versus no-review on held-out tasks with the same model,
   context, tool, and token budgets.
3. Require paired improvement and regression evidence before promoting a
   proposal; include unsuccessful runs and abstentions.
4. Track proposal rate, abstention rate, stale-rejection rate, rollback rate,
   added tokens/cost, and downstream reuse—not only successful writes.
5. Start with pending proposals. Test automatic application only for
   system-owned artifacts whose evaluator and rollback path are independent of
   the proposer.

### Reject

- Prompts or metrics that imply most sessions should mutate persistent skills.
- Fail-open behavior for optional, cost-incurring background review.
- Self-improvement claims based on creation, write success, or self-evaluation
  without retained held-out gains.
- Unqualified “only agent” marketing.
- Treating routing, workspaces, agents, processes, or session keys as hostile
  tenant isolation.
- Assuming Markdown simplicity means poor memory, or that many memory layers
  imply validated recall.
- Replaying stale background actions after their source revision or ownership
  claim changed.

The strongest control remains a simpler system: a normal agent loop, bounded
curated memory, pending immutable proposals, an external held-out evaluator,
and operator-controlled activation. Added autonomous layers should have to beat
that baseline rather than being credited for activity.

## Remaining limits and stopping condition

- OpenClaw was source-inspected but not installed or executed; its dependency
  graph was absent and deliberately not fetched. Runtime documentation remains
  upstream evidence.
- The two Hermes component reproductions are narrow checks, not an end-to-end
  model campaign, live Gateway test, concurrency test, or security proof.
- Issue symptoms that require production history, private evidence, repeated
  migrations, or real provider load remain upstream reports.
- No normalized model/provider/cost setup was available, so relative latency,
  quality, and dollar cost are unknown.
- The 27 matching Xiaohongshu cards lack technical bodies in the durable
  evidence set. Their titles were fully inventoried and converted into primary
  questions, but were not promoted into claims.
- Both repositories move quickly. Conclusions apply to the exact pinned
  revisions and releases above; later fixes or redesigns require a new snapshot.

The investigation stops because every matching existing lead has a disposition,
every required comparison dimension has primary evidence or an explicit
unknown, the highest-value safe component checks are recorded, and the
remaining gaps require a materially different runtime campaign, private
operator evidence, or future upstream changes. Further browsing of the same
unchanged sources would not strengthen the conclusions.

## Primary source index

### Hermes Agent

- [README and product claims](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/README.md)
- [Agent conversation loop](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/agent/conversation_loop.py)
- [Background review implementation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/agent/background_review.py)
- [Memory documentation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/memory.md)
- [Skills documentation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/skills.md)
- [Skill manager and guards](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/tools/skill_manager_tool.py)
- [Command approval classifier](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/tools/approval.py)
- [Delegation documentation](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/delegation.md)
- [Session lifecycle](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/docs/session-lifecycle.md)
- [Security policy](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/SECURITY.md)

### OpenClaw

- [Agent loop and writer claims](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/agent-loop.md)
- [Gateway architecture](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/index.md)
- [Memory architecture](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/memory-architecture.md)
- [Memory provenance and deletion](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/memory-provenance.md)
- [Active Memory](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/active-memory.md)
- [Dreaming and consolidation](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/dreaming.md)
- [Standing intents](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/standing-intents.md)
- [Skill Workshop](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/tools/skill-workshop.md)
- [Subagents](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/tools/subagents.md)
- [Restart recovery](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/restart-recovery.md)
- [Security posture](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/security/index.md)
- [Multi-tenant boundary](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/multi-tenant-hosting.md)
- [In-process plugin boundary](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/plugins/architecture.md)
- [Heartbeat preflight-compaction branch](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/src/auto-reply/reply/agent-runner-memory.ts)
