<ai_context>
summary: "ToolReplay usefully separates strict transcript parsing, hash-chain integrity, repeated-call consistency, and declared tool-name scope, but its code also exposes why these assurances must not be collapsed into 'replay': it never re-executes tools, singleton calls have no consistency oracle, the unsigned chain has no provenance, and name-level allowlists do not validate arguments or runtime authority."
triggers: ["ToolReplay", "agent transcript audit", "deterministic replay", "hash chain", "tool scope", "provenance", "permission overreach", "agent assurance layers"]
last_updated: "2026-09-15"
source_basis: "GitHub repository Matthew0822/ToolReplay at pinned revision a9f1374479e91ecfcb837658285bfc7a2258dd0b; inspected its README, complete Git tree, transcript, replay, chain and scope implementations, relevant tests, and CI workflow; independently ran its 34 unittest cases with PYTHONPATH=src."
</ai_context>

# Transcript audits need separate assurance labels

**Date:** 2026-09-15  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/Matthew0822/ToolReplay  
**Pinned revision:** [`a9f1374479e91ecfcb837658285bfc7a2258dd0b`](https://github.com/Matthew0822/ToolReplay/commit/a9f1374479e91ecfcb837658285bfc7a2258dd0b)

## Observation

ToolReplay is a small, dependency-free Python CLI for auditing JSONL agent tool-call transcripts. Its implementation separates four useful checks:

1. the parser rejects missing, extra, mistyped, or non-sequential records;
2. a SHA-256 chain detects changes made after a transcript was sealed;
3. the replay module compares identical recorded calls and flags different recorded responses or narrowly defined redundant repeats; and
4. a scope checker flags tool names absent from a declared, exact-match allowlist.

The separation is more valuable than the product label. Despite the module docstring's phrase “deterministic re-execution,” [`replay.py`](https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/replay.py) does not invoke tools or an environment. The first recorded response for a canonicalized `(tool, args)` pair becomes the in-transcript oracle; only a later identical call can disagree with it. A session of unique calls can therefore “replay cleanly” without any result being independently reproduced.

The other checks have similarly precise boundaries. [`chain.py`](https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/chain.py) verifies internal continuity but uses an unkeyed digest: an editor can change records and reseal the entire chain. [`scope.py`](https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/scope.py) checks only exact tool names, not whether arguments stay within a path, resource, tenant, or effect boundary. The repository's README states the chain's unsigned limitation explicitly; the implementation makes the replay and scope limits directly inspectable.

## Why this matters

Agent audit reports should name the assurance actually established rather than emit one overloaded “verified” verdict. A practical evidence stack is:

- **well-formedness:** the record has a strict, complete schema;
- **integrity:** the bytes have not changed since a trusted checkpoint;
- **consistency:** repeated observations agree under a stated environment model;
- **authorization:** both the tool and its arguments were permitted at execution time; and
- **reproducibility:** tools were actually re-executed against pinned or reconstructed dependencies and outputs were compared.

ToolReplay implements useful pieces of the first four, but only at transcript-local or name-level resolution. Production agent receipts can build on the pattern by signing or externally anchoring the terminal digest, recording mutable-environment identifiers, validating argument-level capabilities, and reserving “replay” for actual re-execution. This prevents a clean singleton-only transcript, a self-resealed transcript, or an allowed tool pointed at a forbidden target from inheriting a stronger assurance than the evidence supports.

## Verification and evidence limits

- Scout retrieved the pinned repository tarball and ran `PYTHONPATH=src python3 -m unittest discover -s tests`: all 34 tests passed. The first bare test invocation failed because the package was not installed; the successful command supplies the source path directly, while repository CI installs the editable package before testing.
- The pinned recursive tree response reported `truncated=false` with 44 entries. Review was targeted to the README, core audit modules, tests, and CI rather than a security audit of every line.
- Passing fixture tests establish the implemented behavior on those cases; they do not establish transcript provenance, live tool determinism, or containment of tool effects.

## Sources

- Repository: https://github.com/Matthew0822/ToolReplay
- Pinned README: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/README.md
- Strict transcript parser: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/transcript.py
- Recorded-response comparison: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/replay.py
- Hash chain: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/chain.py
- Tool-name scope check: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/src/toolreplay/scope.py
- Tests: https://github.com/Matthew0822/ToolReplay/tree/a9f1374479e91ecfcb837658285bfc7a2258dd0b/tests
- CI workflow: https://github.com/Matthew0822/ToolReplay/blob/a9f1374479e91ecfcb837658285bfc7a2258dd0b/.github/workflows/ci.yml
- Complete pinned tree: https://api.github.com/repos/Matthew0822/ToolReplay/git/trees/a9f1374479e91ecfcb837658285bfc7a2258dd0b?recursive=1
