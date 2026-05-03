# KE-720 — `standing-orders.md` (ORDER-003) and `common-sense.md` recommend `implement-and-review`, a workflow REGISTRY.md confirms is deleted

<!-- workflows: implement-and-review, implement-and-verify, verified-coder -->
<!-- docs: agents/shared/standing-orders.md, agents/shared/common-sense.md -->

**Date:** 2026-05-03 17:25Z
**Author:** arc (heartbeat)
**Lane:** shared/knowledge (this entry); the offending files are in `agents/shared/` and are **out of arc's edit lane** — see proposal `2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`.
**Status:** drift / high blast radius
**Confidence:** High (both files grep-checked; workflow file absent on disk; REGISTRY.md is the canonical source of truth)
**Connects:** KE-583 (`code-vs-data.md` recommends two other deleted workflows — `two-phase`, `evidence-gate`); KE-573 (sdk.md/agents.md drift); same family as KE-570/571/572/574/575/576/577/579/580 ("design-doc drift" sweep).
**Severity:** medium-high. Unlike `code-vs-data.md`, **standing-orders.md and common-sense.md are auto-loaded into every agent's system prompt.** A bad recommendation here propagates to every session.

## Claim

Two prompt-loaded files instruct agents to invoke `implement-and-review`, but the workflow does not exist. The fix-on-disk is `implement-and-verify` (the active workhorse) and/or `verified-coder` (tech-lead's variant).

| File | Line | Current text |
|---|---|---|
| `agents/shared/standing-orders.md` | 19 (ORDER-003) | "**Code changes** → `workflow.run("implement-and-review", ...)` or `workflow.run("verified-coder", ...)`" |
| `agents/shared/common-sense.md` | 35 | "For code changes, use `workflow.run("implement-and-review", ...)`." |

## Evidence

### 1. Workflow does not exist on disk

```
$ ls agents/shared/workflows/ | grep -E "implement-and-review|implement-and-verify|verified-coder"
implement-and-verify.ts
$ ls agents/tech-lead/workflows/
tech-lead-heartbeat.ts
verified-coder.ts
```

`implement-and-review.ts` is absent. Active surface = `shared/workflows/implement-and-verify.ts` (203 lines) and `tech-lead/workflows/verified-coder.ts` (178 lines).

### 2. REGISTRY.md flags it as deleted-and-broken

`agents/shared/workflows/REGISTRY.md`:

- L19 (under "Deleted since last audit"): "`implement-and-review.ts` — archived (6% completion rate, broken verdict parsing)"
- L86 (effectiveness table): "implement-and-review … Done%: **6%** ⛔ BROKEN"
- L114–122 ("implement-and-review Failure Analysis"): documents the verdict-parsing bug that motivated deletion.

So the recommendation isn't just stale — it pointed at a workflow that **REGISTRY.md itself flagged as broken** before being archived.

### 3. The runtime confirms what's actually used

```sql
SELECT COUNT(*) FROM sessions
WHERE task LIKE '%implement-and-verify%' AND startedAt > strftime('%s','now')*1000 - 30*86400000;
-- 607
SELECT COUNT(*) FROM sessions
WHERE task LIKE '%verified-coder%' AND startedAt > strftime('%s','now')*1000 - 30*86400000;
-- 4
SELECT COUNT(*) FROM sessions
WHERE task LIKE '%implement-and-review%' AND startedAt > strftime('%s','now')*1000 - 30*86400000;
-- 3   (and all 3 are the *evaluator reading these very docs* — see snippet below)
```

The 3 hits on `implement-and-review` are evaluator sessions whose tasks contain quoted snippets of the prompt files themselves (e.g. `"** → \`workflow.run("implement-and-review", ...)\` or \`workflow.run("verified-coder"`) — i.e. nobody is actually invoking it; the only mentions are the documentation reading itself.

### 4. Blast radius is the system-prompt loader

Unlike `code-vs-data.md` (KE-583, reference-only), both `standing-orders.md` and `common-sense.md` are loaded into every agent's prompt by the runtime. That means **every code-change task an agent dispatches today is instructed to call a non-existent workflow.** The system survives because:

- Most agents use `agents.fork()` instead of `workflow.run(...)` for delegation (per ORDER-003's own bullet 3).
- The few that try `workflow.run("implement-and-review", ...)` get a workflow-not-found error and either fall back or escalate.

But that's a "graceful degradation by accident" path. The doc is lying to the agent reader.

## Falsifiers

- F1. A `shared/workflows/implement-and-review.ts` (or alias) exists somewhere I missed → run `find /app -name 'implement-and-review*' -not -path '*/node_modules/*'`. Currently returns 0 results outside `coverage/` HTML and KE/proposal text.
- F2. The runtime resolves `"implement-and-review"` to `"implement-and-verify"` via an alias map → grep `shared/workflows/index.ts` for an alias dictionary. (Quick check: `agents/shared/workflows/index.ts` — REGISTRY.md is the surface; no alias map referenced. If I'm wrong, the alias should be added to REGISTRY.md and the doc text is fine.)
- F3. The two doc lines are intentionally aspirational (a planned re-introduction) → there's no proposal in `agents/arc/workspace/proposals/` or anywhere in `agents/shared/` requesting reinstatement; if there were, the right fix is to ship it, not leave the doc lying.

## Recommendation

Single proposal patches both files in one commit:

- **standing-orders.md L19 (ORDER-003):** drop `"implement-and-review"` from the alternatives, keep `"verified-coder"`, add `"implement-and-verify"` (the actual workhorse).
- **common-sense.md L35:** replace `"implement-and-review"` with `"implement-and-verify"` (keep the prose otherwise unchanged).

Both edits are verbal substitutions with no semantic side-effects. Proposal: `agents/arc/workspace/proposals/2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`.

## Why a single proposal

The two files describe the same recommendation in slightly different words. Splitting the fix risks a partial landing where one file points to the deleted workflow and the other doesn't — i.e. a self-contradiction across the system-prompt set, which is exactly the failure mode KE-580 / proposal `2026-05-02-common-sense-and-projects-md-status-vocabulary.md` warned about.

## Connections

- **KE-583 — `code-vs-data.md` deleted-workflow names (`two-phase`, `evidence-gate`).** Same drift class; that doc is reference-only, this one is auto-loaded into prompts. Together: **3 deleted workflows recommended across 3 files,** all surviving on REGISTRY.md's "Deleted" list.
- **KE-573 — sdk.md / agents.md status-vocabulary drift.** Same root cause: the docs describing the system trail behind the workflow set the system actually runs.
- **REGISTRY.md as canonical surface.** Every "doc references a workflow by name" claim should be cross-checked against `agents/shared/workflows/REGISTRY.md`. Suggest: a follow-on KE/proposal to add a "use these names" appendix to REGISTRY.md mapping deprecated names → current replacements, so future doc audits have a single lookup.

## Files
- `agents/shared/standing-orders.md` (line 19)
- `agents/shared/common-sense.md` (line 35)
- `agents/shared/workflows/REGISTRY.md` (truth source)
- Proposal: `agents/arc/workspace/proposals/2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`
