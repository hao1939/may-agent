# Knowledge Context

## Team
Scout researches (Opus). Amy explores XHS (Opus).
Bob is Architect (Gemini). Coach trains (Opus).

## Design Philosophy (distilled)
- **Deep Insight**: Prefer depth over breadth. One insight > ten shallow ones.
- **Evidence Over Theory**: Read the paper/code, don't guess.
- **Context Engineering**: Selection, Compression, Persistence.
- **Growth Cycle**: Fork → Train → Verify → Promote.

## Skills (distilled)
- **Research**: Use `scrape_webpage`. Cross-reference sources.
  Archive findings to `knowledge/library/`.
- **File Safety**: Read before write. Verify edits.
- **Error Handling**: Escalate failures. No silent failures.

## Project Layout
- `agents/scout/knowledge/library/` — your research archives

## Knowledge Files
- `consolidated-2026-03-15.md` — DD#1-221, CR#1-72, GUS v1-v5 (baseline)
- `consolidated-2026-03-18.md` — DD#222-427, CR#73-237, Seven Laws, W12 capstone
- `consolidated-2026-03-20.md` — DD#428-443, CR#238-249, memory lineage, reasoning safety, Thursday batch
- `consolidated-2026-03-25.md` — DD#444-469, CR#250-256, Trust Theory (complete), Governance Stack, Meta-Design (current)
- `coaching.md` — patterns from OpenClaw system
- `lessons.md` — evaluator feedback

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — research standards
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  write safety recovery (handle WRITE BLOCKED properly — read full file first),
  path discovery, validation. Anti-patterns: non-delivery (persist findings
  early), planning without executing.
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on.
- `agents/shared/skills/stale-approach-fixation/SKILL.md` — read workspace notes
  and context files BEFORE your first task-action tool call. Never retry a tool
  or approach documented as unavailable. Use documented working approaches instead
  of defaults. Document new discoveries for future sessions. Prevents 3-5 wasted
  turns/session from retrying dead tools or re-deriving known findings.
- `agents/shared/skills/verification-consistency/SKILL.md` — maintain read-back
  verification at a consistent rate throughout your entire session. You have a
  0% verification rate across 9 edits in 3 sessions. Every edit must get a
  read-back within 3 tool calls, regardless of position in the session. This
  is a companion to the verification skill — it addresses WHEN verification is
  skipped (later edits, same-file edits, end-of-session), not what or how.
  Anti-patterns: first-edit-only verification, end-of-session rush, "the edit
  tool works fine" trust. Gym tested: 3/3 pass on convention-verify-multi-edit.
- `agents/shared/skills/progressive-work-persistence/SKILL.md` — save
  intermediate work products to disk as each deliverable completes, rather than
  buffering all output in context until the end. Your research sessions produce
  multiple deep-dives and triage reports — if the session ends mid-analysis,
  unwritten findings are lost. Follow Scout's own SAVE-AS-YOU-GO pattern:
  write each deep dive immediately after completion (DD#463 → disk → DD#464 →
  disk). Checkpoint after major state changes (15-20 ops between checkpoints
  max), and save before risky operations (scrapes that might fail, delegations).
  Anti-patterns: delayed batch (completing 3+ analyses then writing all at end),
  context-only analysis (findings exist only in conversation). Gym tested: 3/3
  pass on progressive-work-persistence scenario.
