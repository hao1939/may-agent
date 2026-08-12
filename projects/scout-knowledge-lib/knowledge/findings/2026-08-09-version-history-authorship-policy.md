<ai_context>
summary: "Git-history ranges and Claude's model-level content marks expose different provenance signals, but neither proves authorship or authority. Use them for review routing only with explicit identity confidence, transformation history, and independent enforcement."
triggers: ["authorship provenance", "agentic editing", "human-authored code", "edit caution", "Git history attribution", "content watermarking", "C2PA", "Claude content marking", "Us vs. Them"]
confidence: "medium"
discovered: "2026-08-09"
source_basis: "HN items 49232300 and 49250109; eighttrigrams/us-vs-them commit b457badb175a78d985fc46e7392b5d6fe446e10d; Anthropic content-marking policy"
</ai_context>

# Version-history authorship is useful policy input, not an authority boundary

**Date:** 2026-08-09  
**Source:** https://news.ycombinator.com/item?id=49232300  
**Repo:** https://github.com/eighttrigrams/us-vs-them  
**Inspected commit:** `b457badb175a78d985fc46e7392b5d6fe446e10d`

## Signal

The Show HN project **Us vs. Them** converts a file's Git history into ranges scored from `0` (agent-authored, freely revisable) to `1` (human-authored, high caution). Its implementation does more than blame the latest revision: it replays the file history, preserves coherent authorship “islands,” and gives mixed islands a fractional caution score when later agent edits become entangled with human-authored text. The CLI follows renames with `git log --follow` and classifies commit-author email addresses through an explicit `--ours` human allowlist or `--theirs` agent list.

This is a useful response to an agent-editing problem that ordinary diffs do not express: **not all unchanged or adjacent text carries the same human intent**. A generated README and a hand-rewritten opening paragraph may be in one file, yet deserve different edit and review policies.

## Practical interpretation

Authorship ranges can drive several low-risk controls:

1. require stronger justification or human review when a patch touches high-caution ranges;
2. route generated regions to broader autonomous refactoring while protecting hand-shaped interfaces and prose;
3. show reviewers when a proposed rewrite crosses from agent-dominated into human-dominated history; and
4. record the before/after provenance map in a change receipt so gradual dilution is visible.

The project's island model contributes an important idea: provenance need not be a brittle per-line label. If an agent inserts one line into the middle of a human-authored block, treating that line as wholly disposable may still endanger the surrounding human design. A graded range can encode that local entanglement better than binary blame.

## Boundary: attribution is not enforcement

The map should remain **policy input**, not proof of authority or a security boundary.

- Git author email is asserted commit metadata. Shared accounts, rebases, squashes, delegated commits, imported patches, and agents committing under a developer's configured identity can all misclassify origin.
- The CLI's `--theirs` mode treats every unlisted author as human, while `--ours` treats every unlisted author as agent. Either policy can fail as identities and tools change unless actor identity is captured at the execution boundary.
- A caution score describes history-derived editing sensitivity; it does not prove semantic importance, correctness, ownership, or permission.
- The HN thread's only comment reports that explicit annotations are still ignored by agents in a small fraction of cases. That anecdote reinforces the distinction between telling an agent to be careful and structurally requiring review or blocking an effect.

For stronger use, bind each change to an authenticated actor class when it is produced, preserve that identity through merge and rewrite operations, and enforce high-caution edits in an independent patch gate. Keep the range map advisory when provenance is inferred only from ordinary Git authorship.

## Calibration

This is a concrete, small open-source implementation with tests in the repository, but the runtime needed to execute its Clojure test suite was unavailable in this environment. The HN item had 13 points and one comment when checked, so there is not yet broad field evidence that the heuristic improves review outcomes. The durable hypothesis is narrower: version-history-derived, graded authorship ranges can improve edit triage, provided identity confidence and enforcement strength are represented separately.

## Update — 2026-08-11: content marks prove processing more readily than authorship

**Source:** https://news.ycombinator.com/item?id=49250109  
**Linked policy:** https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content

Anthropic's newly discussed content-marking policy adds a second provenance mechanism that sharpens the same boundary. It says supported Claude models launched in the EU on or after August 2, 2026 will mark output worldwide and across API, Claude, Claude Code, Cowork, Tag, and participating cloud surfaces. Generated text receives a model-level embedded watermark; supported generated files such as SVG, PNG, and JPG receive signed C2PA provenance metadata where the platform supports it.

The policy itself makes two qualifications that should govern downstream use:

- a detected mark says only that content **may have been processed by Claude**; Claude could have proofread, translated, summarized, or converted human-authored material, and the marked output could later have been combined with other sources;
- an absent mark does not establish human origin, because older models, short passages, heavy editing or paraphrasing, translation, mixing, metadata stripping, and unsupported surfaces or formats can erase or prevent detection.

At the time checked, Anthropic said third-party detection mechanisms would be described in forthcoming technical documentation. The HN thread therefore could inspect the policy but not independently test detection thresholds, false-positive behavior, editing robustness, or any effect on generated code. Commenters repeatedly raised those four issues and the likelihood of sanitizers; these are useful requirements for evaluation, not evidence that a particular implementation succeeds or fails.

### Reusable control: keep provenance claims typed

A content mark and a history-derived author score should not collapse into one `AI-generated` boolean. Preserve at least four separate fields:

1. **processing evidence** — which tool or model touched the artifact and how the signal was verified;
2. **authorship inference** — who supplied the substantive expression or intent, with confidence;
3. **transformation history** — proofreading, translation, paraphrase, generation, conversion, merge, and metadata-stripping steps; and
4. **policy consequence** — disclosure, review routing, edit caution, or blocking, enforced outside the detector.

This distinction prevents both common inversions: treating a positive processing mark as proof that no human authored the work, and treating a missing or removed mark as proof that no model participated. For agent-produced code, mark-preservation and detector behavior also belong in release tests before provenance is used for compliance or access decisions.
