<ai_context>
summary: "Current Hermes Agent and OpenClaw both have native learning loops, subagents, persistent memory, and recovery machinery. Their useful distinction is direct mutation versus governed state transitions; neither has controlled evidence of general self-improvement."
triggers: ["Hermes Agent comparison", "OpenClaw comparison", "learning-loop governance", "Skill Workshop", "background skill review"]
last_updated: "2026-09-22"
source_basis: "Official repositories pinned at Hermes 1cb3ab6 and OpenClaw 1212f99, official docs/releases, bounded isolated Hermes checks, six attributed issue records, and one observational XHS discussion read on 2026-09-22."
</ai_context>

# Hermes Agent vs OpenClaw: the difference is mutation governance

## Finding

Current Hermes Agent and official OpenClaw both implement native subagents,
persistent memory, long-running work, recovery, and a learning loop. The old
comparison—Hermes learns while OpenClaw is only a flat Markdown-memory bot—is
false at the pinned 2026-09-02 revisions.

The real difference is how persistent change becomes active:

| | Hermes Agent | OpenClaw |
|---|---|---|
| Learning path | A background `AIAgent` reviews recent work and can write memory or skills directly. | Skill Workshop creates pending proposals with generations, hashes, scanning, staleness checks, and rollback metadata. |
| Default pressure | Review is enabled by default, fails open on config-read errors, and is told most sessions should produce a skill update. Memory/skill approval is opt-in. | Autonomous mode can update Workshop-owned state; human-authored skills remain read-only to autonomous review. |
| Main strength | Short, legible path from experience to reusable memory or procedure. | Explicit ownership, review, revision, recovery, and terminal states. |
| Main risk | Mutation pressure and proposer-as-evaluator bias. | Large coupled state and migration surface. |
| Improvement evidence | Durable writes and guards are implemented; held-out efficacy is not demonstrated. | Governed proposal/apply/rollback is implemented; held-out efficacy is not demonstrated. |

Hermes' review fork can run 16 model/tool iterations with a default aggregate
input budget of 600,000 tokens. Its controls—read-before-write, protected skill
classes, content scanning, bounded memory, optional approval, and
notifications—are real, but they do not substitute for a regression test.
Hermes separately documents an RL training pipeline powered by external
Atropos and implements trajectory export; that training integration is real,
but it is not the runtime self-review loop and was not evaluated here.

OpenClaw's memory is now layered: curated files, daily notes, transcripts,
provenance and session-kind gates, hybrid/trigger recall, Active Memory,
project scope, dreaming, standing intents, admission/deletion controls, and an
optional wiki. This is more governed than “flat Markdown,” but more layers are
not evidence of better recall.

Both security models ultimately require operating-system isolation. Hermes has
an always-on catastrophic-command floor; OpenClaw has broad sender, tool,
device, and audit controls. Their normal local defaults still grant broad
operator authority, and neither workspaces nor multi-agent routing provide
hostile tenant isolation.

## XHS adoption signal: visibility decay is not project death

A current observational read of an August 24 XHS post found a highly engaged
claim that OpenClaw had “disappeared” only months after its mass-market moment:
**1,270 likes, 557 collections, and 469 comments** at observation. The body
provides no usage, release, repository, or shutdown evidence, so it does not
establish that OpenClaw declined or died.

The comments are more useful as a segmentation signal than as a popularity
measure. Some participants described OpenClaw as obsolete or lacking practical
use; others reported an instance running for two months, disputed claims that
new agents are built on OpenClaw, or described moving to Hermes because they
wanted a personal-manager layer alongside Claude Code for complex coding. This
supports a narrower interpretation: public attention can move on before the
underlying workflow category disappears, and users distinguish a coding
executor from a persistent personal coordinator. It does **not** show which
product retains more users or solves tasks better. Technical judgments in this
note remain grounded in the pinned project sources above, not this social-media
reception sample.

- XHS observation: [“OpenClaw像从没存在过一样消失了”](https://www.xiaohongshu.com/explore/6a8c54760000000033029f8d), note ID `6a8c54760000000033029f8d`.

## Consequence for Scout and Herdr

Adopt proposal-first mutation, expected-revision hashes, provenance classes,
single-writer claims checked inside the commit transaction, pre-images,
immutable transition history, idempotency receipts, explicit terminal states,
separate prospective-intent state, hard catastrophic-command floors, and
bounded retries.

Experiment with background review only under a held-out comparison that tracks
paired improvement/regression, tokens and cost, proposal and abstention rates,
staleness, rollback, and downstream reuse.

Reject prompts that pressure most sessions to mutate, fail-open optional
background work, unqualified “only agent” marketing, and self-improvement claims
based only on successful writes.

## Evidence and limits

- Hermes pinned revision:
  [`1cb3ab617363ffab9e55239a7d2ab0d6f9c10473`](https://github.com/NousResearch/hermes-agent/commit/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473),
  especially [`background_review.py`](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/agent/background_review.py),
  [memory](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/website/docs/user-guide/features/memory.md),
  and [security](https://github.com/NousResearch/hermes-agent/blob/1cb3ab617363ffab9e55239a7d2ab0d6f9c10473/SECURITY.md).
- OpenClaw pinned revision:
  [`1212f991db46ad4ffe8c11198c175a5736392a15`](https://github.com/openclaw/openclaw/commit/1212f991db46ad4ffe8c11198c175a5736392a15),
  especially [agent loop](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/agent-loop.md),
  [memory architecture](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/concepts/memory-architecture.md),
  [Skill Workshop](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/tools/skill-workshop.md),
  and [restart recovery](https://github.com/openclaw/openclaw/blob/1212f991db46ad4ffe8c11198c175a5736392a15/docs/gateway/restart-recovery.md).
- Isolated Hermes checks verified representative memory write/reload, rejection,
  size limiting, and command-classifier paths. They were not an end-to-end
  provider campaign.
- OpenClaw was not executed because its clone had no installed dependency graph;
  current claims are source inspection or attributed upstream documentation.
- The current OpenClaw source directly confirms that heartbeat preflight returns
  before checking the transcript-byte fuse; issue
  [`#136452`](https://github.com/openclaw/openclaw/issues/136452)'s out-of-memory
  impact was not reproduced.

Full lead reconciliation, rubric, issue evidence, and source index:
[Hermes Agent and OpenClaw comparative investigation](../../reports/research/hermes-agent-openclaw-comparative-investigation-2026-09-02.md).
