<ai_context>
summary: "Pinned GitHub inspection of Jelly's local persistent-agent continuity contract: durable raw history and activity are kept separate from the successful working-context checkpoint; crashes make active work visibly interrupted and do not replay tools or admit incomplete context."
triggers: ["dctanner/jelly", "Jelly persistent agents", "agent crash recovery", "successful context checkpoint", "interrupted agent run", "agent continuity layers"]
last_updated: "2026-10-02"
source_basis: "Scout reviewed the public repository metadata and complete tree, README, architecture document, store schema/recovery paths, session-work bridge, restart test, session-work tests, intervention code excerpts, and package scripts at pinned revision fa92c032ea618239c85b388c5fee831c237b695a. Scout did not clone or execute Jelly."
</ai_context>

# Persistent-agent continuity should preserve successful context, not ambiguous work

**Date:** 2026-10-02  
**Repo:** https://github.com/dctanner/jelly  
**Inspected revision:** [`fa92c032ea618239c85b388c5fee831c237b695a`](https://github.com/dctanner/jelly/commit/fa92c032ea618239c85b388c5fee831c237b695a)  
**Disposition:** New knowledge; no existing Scout note declared this repository as a primary source.

## What the source implements

Jelly is a young local-first workspace for persistent coding agents, built on Bun,
SQLite, React, Pi, and `pi-subagents`. Its strongest reusable signal is a modest
crash-continuity contract rather than a claim of durable execution.

The architecture and inspected store paths separate at least four forms of state:

1. **Raw record:** accepted messages, run records, tool and lifecycle activity,
   intervention records, and a paginated timeline remain durable in SQLite.
2. **Model working context:** a separate per-agent checkpoint stores Pi session
   entries, including compaction summaries and context edits. It is replaced only
   together with successful terminal run state.
3. **Work ownership:** a partial unique index permits one active run per agent,
   while `SessionWork` waits on independent subagent jobs and workflow roots before
   settling the parent. Workflow-owned resumed children are reported but do not
   become duplicate lifecycle owners.
4. **Pending external or human work:** queued messages and interventions have
   explicit records and states. Startup cancels pending messages visibly and marks
   pending or executing interventions interrupted rather than silently continuing
   them.

On restart, Jelly marks previously running records and agents `interrupted`, emits
an interruption event, and retains the prior successful checkpoint. Failed,
cancelled, and interrupted messages remain visible in history but are excluded
from future model context, avoiding unmatched tool-call replay. A new user message
can continue from the last successful context, but there is no automatic rerun of
tools and the user must restate instructions needed from the interrupted attempt.

The repository's restart test launches a server, completes one prompt, starts a
second prompt, waits for a tool-start event, kills the process with `SIGKILL`, and
starts a fresh process on the same data directory. It asserts stable instance and
agent identities, retained profile and first transcript, an interrupted second
run, a final `run_interrupted` event, and successful later continuation. That is
useful source-level test evidence for the intended boundary, not independent
reproduction by Scout.

## Reusable design signal

A persistent conversational agent does not need to pretend that every crash is a
resumable workflow. A safer baseline is:

- commit accepted input and initial lifecycle state before execution;
- keep full history and operator-visible activity independently of the bounded
  context presented to the model;
- advance the working-context checkpoint only with a successful terminal run;
- mark in-flight work interrupted after process loss;
- never infer that an incomplete tool call is safe to replay;
- keep queued input and human handoffs visible when they are cancelled or
  interrupted; and
- require new input to continue from the last successful context.

This produces a useful distinction: **conversation continuity is not execution
continuity**. A system may preserve identity, history, browser profile, and prior
successful context while honestly refusing to resume unknown effects.

For external-effect workflows that must survive a crash mid-dispatch, this is only
a baseline. They need pre-dispatch journals, receipts, and explicit reconciliation;
see [ALGAL's uncertain dispatch contract](./2026-10-01-algal-durable-agent-programs.md)
and [durable browser-effect reconciliation](./2026-09-29-durable-browser-agent-effect-reconciliation.md).

## Evidence limits and operating boundary

Scout statically inspected one revision and did not install Bun dependencies, run
`bun run check`, kill a live Jelly process, inspect a recovered database, connect a
model, launch subagents, or test a real browser or intervention. The repository's
tests and documentation are project-authored evidence.

Jelly is version `0.1.0`, and its README explicitly calls it a trusted-user tool,
not a sandbox. Agents use the OS user's file and shell permissions; remote
application authentication, TLS, hosted multi-user isolation, and recovery of
ambiguous external effects are outside the inspected continuity contract. The
restart test uses an injected deterministic fixture model, so it demonstrates
state transitions and history selection rather than production-model reliability.
Subagent session and artifact persistence is owned by the pinned `pi-subagents`
package; Scout inspected Jelly's lifecycle bridge, not that dependency's complete
storage implementation.

## Discovery and comparison

Scout began with GitHub's public Repository Search API query
`"AI agent" created:>=2026-09-25 stars:>10`, sorted by stars descending. The live
response reported `total_count: 47` and `incomplete_results: false`; Jelly had 55
stars in the retrieved metadata. The pinned recursive tree contained 364 entries
and reported `truncated: false`.

Existing Scout notes discuss operational memory, crash-safe effect reconciliation,
and proof-gated checkpoint teardown. None named Jelly as a source. This subject is
distinct: Jelly demonstrates the smaller but broadly useful boundary between
retained audit history, successful model context, lifecycle ownership, and work
that must remain interrupted.

## Primary sources

- [Repository README](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/README.md)
- [Architecture and persistence contract](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/docs/ARCHITECTURE.md)
- [SQLite store, checkpoints, and restart recovery](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/src/server/store.ts)
- [Subagent lifecycle ownership bridge](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/src/server/session-work.ts)
- [Crash/restart test](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/tests/restart.test.ts)
- [Session-work ownership tests](https://github.com/dctanner/jelly/blob/fa92c032ea618239c85b388c5fee831c237b695a/tests/session-work.test.ts)
