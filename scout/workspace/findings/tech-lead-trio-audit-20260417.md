# Tech-lead trio audit — 2026-04-17

Reviewer: scout (s_1776453350862_574). Scope: commits from 3 flagged sessions.

---

## 1. 0e22b256 — threshold backfill (s_1776442519721_477, 26 ops)

**GREEN.** `scripts/backfill-metric-thresholds.ts` (+245). Idempotent
one-shot: dry-run by default, readonly DB unless `--apply`, preserves
existing thresholds unless `--force`, UPDATEs in a transaction. Each PLAN
entry carries rationale. `system.stuck-requests` explicitly skipped because
renderer predicate (`src/app/cron.ts:710`) only supports `current <
threshold`; comment points at Phase 2. Spot-verified post-apply via
bun:sqlite: 8 health metrics now have thresholds; stuck-requests null as
intended. Nit (non-blocking): PLAN[] hardcoded in script — fine for a
one-shot, owned in commit msg.

## 2. 4b957cd9 — block agents.message from may (s_1776442615172_478, 7 ops)

**YELLOW.** `src/lib/manager-agents-tool.ts` (+8). Early-return in
`case "message"` when caller === "may"; narrow and safe. Concerns:
- No tests; commit self-discloses "No test infra for manager-agents-tool
  handler; gap noted."
- Guard is literal string compare — would miss any future `may-*` alias.
- Superseded 17 min later by d15c5249 which removed the `message` action
  entirely. ORDER-008 now enforced structurally, so the guard is dead code.

## 3. d15c5249 — split agents.message → notify tool (s_1776442914838_479, 74 ops)

**RED (mitigated) + YELLOW (leftover drift).**
Removes `message` action from `agents`; introduces `notify` tool
(`createNotifyTool`); updates 16 files incl. tests and the `method:` union
in `handler-context.ts`. `bun test test/agents-tool.test.ts
test/auto-pause-recovery.test.ts` → 43 pass, 0 fail.

RED — **production regression caught by the trio, not the author**: this
commit dropped `cite-source`/`cite_source` from `VALID_TOOL_PRESETS` in
`src/app/agent-loader.ts`. Result: `may.ts` logged "Loaded 0 agent(s)" and
every gym run aborted. Fixed ~90 min later in 2b7bf30e whose message reads
*"Dropped in d15c5249 (split-notify refactor); re-adding restores agent
loading."* Root cause: ad-hoc edits to the preset allowlist with no test
enumerating expected presets.

YELLOW — **naming drift after the fix-up chain.** 2b7bf30e reverted the
`createNotifyTool` import back to `createSendTool`. Today's HEAD state:
`src/lib/tools/send-tool.ts` still internally exports `createSendTool` with
`name: "message"` and doc "message-tool.ts — Lightweight message-only tool
for leaf agents". The `notify` preset alias (added in e3101f00) routes
through `createSendTool` → tool is literally named `"message"`, not
`"notify"`. Agents declaring `tools: ["notify"]` receive a tool named
`message`. Latent bug for any prompt that references `notify({...})`.

Also: working tree on this branch has uncommitted changes to
`manager-agents-tool.ts` and `send-tool.ts` reintroducing the old
`"message"` action (stash residue from 9833336b wip-heartbeat). Tech-lead
should reconcile before further work on this surface.

---

## Summary
- 1 GREEN (threshold backfill)
- 1 YELLOW (may.message guard; superseded, no tests)
- 1 RED mitigated + YELLOW drift (notify refactor dropped cite-source
  presets → killed gym runs; fixed in 2b7bf30e; tool-name vs preset-name
  still inconsistent; uncommitted residue on branch)

Recommended follow-ups for tech-lead: (a) regression test enumerating
`VALID_TOOL_PRESETS` against a golden list; (b) finish or revert the
notify↔send-tool rename so the tool name matches the preset; (c) clean up
the 9833336b wip-heartbeat residue on the current branch.
