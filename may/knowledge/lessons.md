# Lessons

Evaluator-generated feedback from completed sessions.
This file is auto-managed — new lessons are appended after each evaluation.

---

## Operational Lessons

- Use `waitFor`, not polling. Don't poll `subagents.status()` in a loop.
- Don't re-read files you already know about from domain.md.
- If file content is truncated, continue reading before counting or claiming totals.
- Prefer targeted `edit` over full-file `write` to avoid accidentally deleting content.
- After schema changes, add tests that verify the produced JSON schema shape, not just runtime behavior.

## Verified Workflows

- `implement-and-review`: coder→reviewer→iterate. Works well for clearly-specified tasks.
- `optimize`: optimizer reads evaluations and proposes structural improvements to `.state/staged/proposals/`.

## Optimization Loop

- If optimize workflow hits context overflow, check `.state/staged/proposals/` for existing proposals first.
- Always read current source before implementing proposals — previous iterations may have already done the work.
- Full cycle: optimize → read proposals → implement-and-review → verify (tsc + vitest).

## Technical Notes

- Anthropic provider flattens Type.Union schemas — use flat Type.Object with StringEnum for tool params.
- `send()` persistence gap after archival — FIXED: `send()` now calls `ensureSessionDir()` to recreate the session dir before re-subscribing for persistence.

## Session s_1772359432038_0 (2026-03-01 10:08:11)

- **[correction] `pwd` first, always.** The session again started with guessed `/home/user/...` paths and a `find /home/user ...` sweep before using `pwd`. This is a recurring user-corrected failure; treat as a hard gate before any file reads.
- Avoid full-file overwrites with `write` for large files (domain.md, manager.ts, lessons.md). This session rewrote entire files multiple times, which is high-risk for accidental truncation/regression even if tests pass. Prefer minimal diffs (targeted edits) and verify by re-reading key sections afterward.
- Don’t manually rewrite files labeled “auto-managed” (`agents/may/knowledge/lessons.md`). Even though the change was small, overwriting the entire file undermines the append-only mechanism and risks data loss. If consolidation is desired, it should be done via the designed maintenance flow (evaluator/maintainer), not ad-hoc edits.
- The “send() persistence gap” fix (recreate `sessions/<id>/` via `ensureSessionDir` before persistence re-subscribe) is plausible, but it **should have received a regression test**: e.g., run → completion+archive → send() → ensure JSONL append succeeds and no unhandled error from the subscription callback. Right now it’s only validated indirectly by existing tests.

## Session s_1772359709239_0 (2026-03-01 10:09:03)

- When asked for “trend,” summarize both **early-to-late direction** and **stability/variance** (you did: “getting better but fragile”), and support it with a compact table of key metrics (efficiency/quality/wasted/cost).
- Keep evaluation ingestion tight: `ls`/`find` to enumerate, then read each JSON once; avoid extra greps or re-reads. This session stayed clean.

## Session s_1772359954773_0 (2026-03-01 10:14:24)

- **[correction] `pwd` must be the first tool call, and paths must be repo-relative after that.** The session started with `/home/user` guesses and global `find` sweeps; this is the exact recurring anti-pattern the user has corrected repeatedly.
- Don’t use `find /` (or even `find /home`) to locate tests in a repo that already has `test/`. It pulled irrelevant `node_modules` tests and wasted calls.
- The reasoning correctly noticed an important nuance: **second archival can fail** (`renameSync` into existing `history/<id>`). However, the user asked to verify persistence “in the session JSONL” after archive; the test “hedges” by accepting either `sessions/<id>/session.jsonl` *or* `history/<id>/session.jsonl`. That weakens the regression signal for the specific “archived then send persists” requirement.
- Add a focused assertion aligned to the requirement: after first completion, confirm `history/<id>/session.jsonl` exists; after `send()` completion, confirm **the persisted file you expect (history vs sessions)** contains the follow-up. If the intended behavior is “always end up in history,” then the code needs a follow-up fix (merge / re-archive strategy) and the test should enforce it.
- 2026-03-01 10:22: The optimizer agent (GPT-5.2) hits context overflow when invoked via the optimize workflow because its knowledge files (domain.md ~2.8KB + codebase.md ~3.9KB) plus lessons.md plus memory plus the workflow's injected task instructions exceed GPT-5.2's context window. When the optimize workflow fails, perform the analysis directly from the supervisor agent using evaluation data in .state/evaluations/ and write proposals to .state/staged/proposals/.
