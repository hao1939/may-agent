# Structured Workflow Agent Results

**Status:** Implemented design

## Decision

Every agent step inside a workflow has a structured terminal result. The
workflow author may additionally define the step's domain output schema.

```ts
import { Type } from "@earendil-works/pi-ai";

const ReviewResult = Type.Object({
  verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
  findings: Type.Array(
    Type.Object({
      summary: Type.String(),
      evidence: Type.Array(Type.String()),
    }),
  ),
});

const review = await ctx.runAgent("qa", reviewTask, {
  skill: "verify-change",
  schema: ReviewResult,
});

if (review.status !== "done") {
  return ctx.blocked("QA did not return a valid review", {
    sessionId: review.sessionId,
    error: review.error,
  });
}

review.structuredResult.verdict; // inferred as "pass" | "fail"
```

The workflow remains a compact synchronous block: one step finishes before the
next begins. This design adds no parallel executor, suspended workflow, or new
request type.

## Why Structured Results Are The Default

A workflow encodes a process whose purpose and successful shape are already
understood well enough to reuse. Accepting arbitrary prose as a successful
workflow step moves interpretation back into model memory and weakens the
executable process.

Therefore:

- a workflow agent step always terminates through `finish()`;
- a prose-only response is an error, not a successful step;
- the standard finish envelope records status, summary, evidence, artifacts,
  blockers, and lifecycle updates; and
- when later workflow code needs domain data, the workflow declares its schema
  and receives a validated, statically typed payload.

Free-text completion remains appropriate for human chat and other
non-workflow sessions. It is not a workflow result contract.

## One Terminal Tool

Do not introduce a competing `submit_result` tool. The existing `finish()` tool
is extended per workflow invocation:

```ts
finish({
  status: "success",
  summary: "Review completed with one blocking finding.",
  verification_evidence: ["Step 4: bun test reported 1 failed test"],
  result: {
    verdict: "fail",
    findings: [
      {
        summary: "The regression test fails",
        evidence: ["auth.test.ts: expected 401, received 200"],
      },
    ],
  },
});
```

The runtime composes the standard finish schema with the workflow author's
`result` schema. Pi validates the complete tool call before execution. The same
tool then performs existing deliverable, evidence, lesson, context, and request
side effects and terminates the step.

This avoids two completion tools, duplicated lifecycle logic, and ambiguous
ordering such as “submit a result, then finish.”

## Schema Ownership

The workflow author owns the output schema in the workflow's TypeScript source.
It is part of the reusable process contract and executable revision.

An external caller supplies workflow input but does not inject an arbitrary
schema at invocation time. Allowing callers to replace the schema would make
the same workflow revision have unstable output semantics and would complicate
validation, persistence, evaluation, and resume.

Reusable schema constants may live in ordinary TypeScript modules and be
imported by multiple workflows when they truly share a domain contract.

## Runtime Contract

```text
workflow calls ctx.runAgent(...)
  -> runtime marks the session as requiring finish()
  -> runtime exposes normal tools plus one terminating finish tool
  -> optional workflow schema becomes required finish.result
  -> valid finish: capture envelope and optional result, then terminate
  -> invalid finish: Pi/tool validation returns an error to the agent
  -> turn ends without finish: send one corrective prompt
  -> still no finish: return TaskResult.status = "error"
```

Rules:

1. Every `ctx.runAgent` and `ctx.runAgentSession` call requires `finish()`.
2. `ctx.createSession().prompt()` and guard-injected workflow agent steps use
   the same standard finish requirement.
3. A schema-backed successful result always has `structuredResult`.
4. A missing or invalid payload can never become `status: "done"`.
   A deliberate `finish({ status: "failure", ... })` may still expose its
   validated payload on the error result; infrastructure errors may not.
5. The runtime sends at most one corrective prompt. There is no unbounded retry
   loop.
6. `finish()` terminates only after its semantic checks succeed. A rejected
   finish remains recoverable within the agent turn.
7. Chat and direct non-workflow agent calls retain their current completion
   behavior.

## API

```ts
interface WorkflowAgentOptions<S extends TSchema = TSchema> {
  timeoutMs?: number;
  skill?: string;
  schema?: S;
}

type SchemaBackedTaskResult<S extends TSchema> =
  | (TaskResult & {
      status: "done";
      structuredResult: Static<S>;
    })
  | (TaskResult & {
      status: "error" | "interrupted";
      structuredResult?: Static<S>;
    });
```

`runAgent` uses overloads: calls with `schema` infer `structuredResult`; calls
without it return the standard structured `TaskResult`. The schema is not a new
work identity. The upstream event/task remains the work identity, and the
workflow run remains the execution identity.

## Persistence And Resume

Persist the workflow completion requirement and serializable schema with the
step session so process recovery recreates the same finish contract. The
validated payload is present in the persisted finish tool call, session-end
event, returned `TaskResult`, and workflow step evidence.

On workflow replay, an older step that lacks a finish envelope—or lacks the
required schema payload—is not considered a successful reusable step.

Schema identity should ultimately be included in the workflow executable hash
through the workflow's source/import graph. A separate request or schema
lifecycle object is unnecessary.

## A/B Interpretation

The deterministic POC compares the old free-text completion contract with the
structured finish contract. It measures contract reliability:

- valid outputs accepted;
- invalid outputs rejected;
- false successful completions;
- deterministic downstream usability; and
- recovery after one corrective prompt.

It does not prove that a model's review is factually correct. A live shadow
evaluation may later compare factual quality, evidence quality, latency, and
token use, using the same tasks, model, tools, and skill. Model spend requires
explicit approval.

## Non-Goals

- optional free-text success inside workflows;
- parallel agents, pipelines, or semaphores;
- suspended or asynchronous workflow execution;
- caller-injected runtime schemas;
- replacing skills with schemas;
- a new request type or workflow engine; or
- claiming schema validity proves factual correctness.
