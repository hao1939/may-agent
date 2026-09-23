# Oversized-note review: verified enforcement

**Reviewed:** 2026-09-16; refreshed 2026-09-23

**Signal:** `knowledge/agent-security-verified-enforcement.md` grew from 834 to 1,246 observed physical lines

## Decision

The previously recommended split is now complete. On September 16 the clean
boundary could not safely be used because the implementation-evidence block was
active uncommitted source work. All subsequent source additions are now committed,
and the block had grown to 13 coherent studies, so preserving the deferral would
have left an obsolete maintenance decision.

The original published path remains the architecture catalog. Its substantive
content now ends after **“Hardware confinement does not confer signing authority”**
and the 13 September implementation studies live in
`knowledge/agent-security-enforcement-evidence.md`.

## Resulting boundaries

- `agent-security-verified-enforcement.md`: 524 lines, covering formal and
  architecture-oriented patterns, with reciprocal companion navigation.
- `agent-security-enforcement-evidence.md`: 791 lines, covering implementation
  evidence, assurance limits, runtime path coverage, effect mediation, and
  positive execution evidence.
- The original file retains all 13 moved headings as forwarding anchors. Existing
  links from immutable digest snapshots therefore remain readable and direct
  readers to the exact retained heading in the companion.
- `knowledge/INDEX.md` now describes both scopes separately.

The split keeps the source-grounded prose intact rather than summarizing it away.
Each destination has its own `<ai_context>` summary, triggers, and source basis;
the companion preserves each section's source links and evidence boundary.

## Verification requirements applied

1. The 13 implementation headings occur once with substantive content in the
   companion and once as forwarding anchors in the original.
2. Every forwarding link resolves to the same heading in the companion.
3. The original path and all legacy heading fragments remain readable.
4. Reciprocal file links and both INDEX entries resolve.
5. The candidate contains only the two knowledge-note changes, this report
   refresh, and the required INDEX navigation change; `git diff --check` passes.

The repeated historical `§2.43` headings remain unchanged. They are an older
numbering ambiguity cited by INDEX and scan records, not part of this split; a
blind renumber would break published references without improving the current
oversize signal.
