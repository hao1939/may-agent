<ai_context>
summary: "Mubit and Neon report a database agent that delegates recurring steps to a tuned small model while retaining SQL generation on a frontier model. The useful pattern is step-level promotion: group stable call shapes, hold out whole conversations, then shadow, canary, promote, continuously compare, and demote. Separately, verified lessons are scoped to database, contract, schema, and identifiers, with verdict and retryable delivery recorded together. Reported token, latency, and accuracy results are producer-authored and were not reproduced."
triggers: ["adaptive model routing", "small model delegation", "step-level promotion", "schema-scoped agent memory", "Mubit", "Neon AI Gateway"]
last_updated: "2026-11-13"
source_basis: "Complete Neon producer article, HN item 50474934, and static review of MubitLabs/mubit-neon-db-agent at revision 4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84."
</ai_context>

# Adaptive model delegation needs step-level promotion gates

**Date:** 2026-11-13  
**Disposition:** New source-grounded implementation and measurement signal  
**HN:** https://news.ycombinator.com/item?id=50474934  
**Source:** https://neon.com/blog/mubit-neon-ai-gateway  
**Repo:** https://github.com/MubitLabs/mubit-neon-db-agent  
**Inspected revision:** [`4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84`](https://github.com/MubitLabs/mubit-neon-db-agent/commit/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84)

## Question

How can a repeatedly used agent reduce frontier-model work without routing an
entire task to a weaker model or retaining lessons that become stale after its
environment changes?

## What the sources describe

Mubit sits between an agent and Neon AI Gateway. Calls with the same
instructions, tools, output format, and model are grouped as one recurring task.
After at least 25 accepted replies plus exam material, Mubit trains a small
open-weight model on the recorded traffic. The producer article describes a
staged serving path: hold out whole conversations for an exam, answer copies of
live calls in shadow mode, serve a share of real calls as a canary, promote only
a version that proves no worse than its predecessor, continue sampling against
the frontier model, and demote on quality loss.

The delegation unit is a **step**, not the whole agent. In the reported database
workload, the tuned model handled table listing, table descriptions, and final
answer wording. SQL generation remained on the frontier model because the
small model reportedly reproduced the correct SQL result only 8–10% of the
time. This is stronger evidence for selective promotion than for a general
small-model replacement strategy.

The public template implements a separate runtime-calibration loop. A run can
produce up to three template-derived lessons only after a trusted reference or
reviewer verifies it; evaluation calls can be marked metadata-only so they do
not become training examples. Each lesson carries database, calibration
namespace, business-contract version, schema hash, and used identifiers.
Semantic lessons require the same database and contract, schema mappings require
an exact schema hash, and procedural lessons require their named tables and
columns still to exist. A schema error triggers one refresh and drops lessons
that no longer apply.

The template also makes feedback delivery recoverable. Verdict, lessons, and an
outcome delivery are written in one database transaction. Delivery rows use
idempotency keys, row locking, bounded exponential retry, and a scheduled retry
trigger. This does not make the external receiver transactional with Postgres,
but it prevents a locally accepted verdict from existing without a durable
record of the feedback still owed.

## Reported measurement

The producer ran 20 CL-bench questions three times each, spanning database
schemas before and after a migration. The article reports:

| Setup | Accuracy | Frontier-model input tokens/question | Time/question |
|---|---:|---:|---:|
| gpt-5.5 alone | 60% | 21.7k | 26 s |
| gpt-5.5 + lessons | 68% | 14.3k | 20.1 s |
| lessons + tuned small model | 65% | 5.9k | 15.6 s |

The 73% token reduction and 40% latency reduction compare the final row with the
frontier-only row. The article calls the two-run accuracy difference between
lessons-only and lessons-plus-small-model noise, but supplies no uncertainty
interval or significance analysis. The changed-schema subset reportedly rose
from 7/30 correct with gpt-5.5 alone to 14/30 with lessons.

## Reusable design signal

Adaptive routing should be treated as a promotion system with independent
receipts, not as an opaque cost optimization:

1. define a stable call-shape identity and retain its exact model, prompt, tools,
   output contract, and environment scope;
2. keep whole conversations out of training for evaluation;
3. evaluate each step class separately, because success on schema inspection or
   summarization does not justify delegation of SQL, writes, or other effects;
4. shadow, canary, promote, continuously compare, and demote with explicit
   version and traffic receipts;
5. separate learned model artifacts from recalled operational lessons;
6. bind lessons to the environmental facts that make them valid, and record
   exclusion when those facts drift; and
7. commit an accepted verdict and the obligation to deliver its feedback in the
   same durable operation.

This complements [AgentRun's artifact-promotion finding](../agent-runtime-workflow-and-control-plane-recovery.md#november-12-update-learned-automation-needs-artifact-promotion-gates): AgentRun separates notes, skills, and workflows; this source adds a producer example of promotion and rollback for a learned model at the recurring-step level, plus schema-scoped lesson invalidation.

## Limits

- The benchmark, article, service behavior, and interpretation are
  producer-authored. Scout did not run the template, Mubit, Neon, gpt-5.5, the
  small models, CL-bench, tests, migrations, or evaluation scripts.
- The public repository implements the agent, lesson scoping, evaluation, and
  delivery queue, but the model-training, exam, shadow, canary, promotion, and
  demotion service is external Mubit infrastructure and was not inspected.
- The reported experiment uses one synthetic commerce database agent, 20
  questions, three repetitions, one frontier model, and a controlled schema
  migration. It does not establish transfer to coding agents, effectful tools,
  longer horizons, or unrelated workloads.
- The article provides aggregate rows but no raw run bundle, confidence
  intervals, or per-question comparison. A two-run accuracy gap cannot be
  classified as noise from the supplied data alone.
- Frontier-model input tokens are not total system compute or cost: small-model
  training, inference, calibration traffic, storage, and gateway overhead are
  outside that column.
- Verified reference answers make this demo's lessons unusually clean. Human
  verdicts or weaker graders can promote confident mistakes unless their own
  provenance and quality are controlled.
- The HN item had two points and no comments when inspected, so it contributes
  discovery rather than independent validation.

## Primary inspected sources

- [Neon producer article](https://neon.com/blog/mubit-neon-ai-gateway)
- [HN item 50474934](https://news.ycombinator.com/item?id=50474934)
- [Pinned template README](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/README.md)
- [Lesson derivation and verdict delivery](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/src/learning.ts)
- [Lesson scoping and Mubit transport](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/src/mubit.ts)
- [Bounded agent loop and stale-lesson exclusion](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/src/agent.ts)
- [Transactional delivery queue](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/src/store.ts)
- [Reference-backed evaluator](https://github.com/MubitLabs/mubit-neon-db-agent/blob/4aa6a3ac24cff8ec1c3f0f9abd509dbd56290f84/src/evaluate.ts)
