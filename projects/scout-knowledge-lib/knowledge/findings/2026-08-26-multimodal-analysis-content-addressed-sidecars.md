<ai_context>
summary: "GitHub finding on CDAF: repeated multimodal perception can be moved behind a content-addressed descriptive sidecar, but byte freshness, semantic correctness, and producer trust are separate properties. A small synthetic-video benchmark reports a 10.12x per-question prompt-token reduction; the design is useful while the result remains limited to four clips, twenty questions, one model, and author-run records."
triggers: ["CDAF", "cached descriptive asset", "multimodal sidecar", "video understanding cache", "content-addressed description", "perception cache", "semantic cache invalidation", "multimodal agent context"]
last_updated: "2026-08-26"
source_basis: "GitHub repository README, v1.0 specification, benchmark report, raw result JSON, and benchmark source at UditAkhourii/cdaf revision 61dcde318748a3f5e848830b553c12ef3c52934d."
</ai_context>

# Cache Multimodal Perception as a Content-Addressed Claim Artifact

Date: 2026-08-26  
Source: GitHub  
Repo: https://github.com/UditAkhourii/cdaf  
Revision: `61dcde318748a3f5e848830b553c12ef3c52934d`

## Signal

[CDAF](https://github.com/UditAkhourii/cdaf) proposes a plain-text sidecar for
video: one timestamped description generated from an expensive perception pass,
then reused by later agents as text. The useful idea is broader than its `.cdaf`
format. It turns repeated multimodal interpretation into a reusable,
content-addressed **claim artifact**.

The sidecar names the video, records its byte size and SHA-256, identifies the
generator, and carries human-readable summaries, segments, transcript,
on-screen text, and tags. A consumer can reject the description when the media
bytes change without decoding the media again. Search and selection can then run
over text, while direct perception remains a fallback for a missing, stale, or
insufficient artifact.

## Three properties must remain separate

A media hash solves only one part of reuse:

1. **Freshness:** does this description refer to these exact bytes? CDAF makes
   the full SHA-256 authoritative and treats file size only as a cheap negative
   pre-check.
2. **Semantic adequacy:** does the text preserve the evidence needed for the
   current task? A description adequate for shot selection may omit a safety
   event, fine-grained gesture, uncertainty, or frame-level timing.
3. **Producer trust:** who or what generated the description, under which model,
   prompt, policy, and review process? A `generator` string is useful metadata,
   but neither it nor the media hash proves that the description is truthful.

This yields a safer general protocol:

```text
exact asset bytes
  -> expensive perception pass
  -> versioned descriptive artifact + producer/config provenance
  -> byte-freshness check
  -> task-adequacy check
  -> reuse, enrich, or fall back to direct perception
```

The distinction matters because a perfectly fresh sidecar can still be wrong,
malicious, or too lossy for the downstream question. Cross-organization reuse
would need authenticated provenance or signatures, generator-policy identity,
and possibly review or task-specific verification; CDAF lists signed sidecars
only as roadmap work.

## What the repository demonstrates

The included author-run benchmark uses four synthetic videos with known colors,
hard cuts, and timed words. Across twenty questions per condition with
`gemini-2.5-flash`, the checked-in report records:

- direct video: 19/20 correct, 3,066 mean prompt tokens per question;
- sidecar: 20/20 correct, 303 mean prompt tokens per question;
- 14,405 tokens to generate four sidecars, or 3,601 per video;
- a reported break-even point of about 1.30 downstream questions per video.

The arithmetic in the report is internally consistent: 3,601 generation tokens
divided by 2,763 tokens saved per question is about 1.30. More importantly, the
benchmark source generates clips from scripted recipes and grades fixed answers
without an LLM judge. This is a useful mechanism probe: when repeated questions
are answerable from the cached description, the expensive media tokens need not
be paid each time.

## Evidence limits

The reported `10.12x` ratio is not a general estimate for real video workloads.

- The test set contains only four synthetic clips and five question templates per
  clip. It does not exercise speech ambiguity, occlusion, continuous action,
  crowded scenes, subtle visual evidence, or adversarial content.
- The comparison uses one model and checked-in author-run results. There are no
  repeated trials, uncertainty intervals, independently reproduced records, or
  natural-footage benchmark yet.
- The sidecar-generation cost is counted, but lifecycle costs such as storage,
  refresh, review, richer descriptions, and failed adequacy checks are not.
- The claimed production reduction to roughly one twenty-fifth is not supported
  by public workload traces in the repository and should be treated as
  self-report, not benchmark evidence.
- Sidecar quality is upstream of every reuse. Reusing one omission many times can
  amplify error even while reducing tokens.

## Implication

Agents should cache **perception products**, not merely provider responses, when
an expensive asset is likely to be revisited. The artifact should be diffable,
searchable, bound to exact source bytes, and cheap to invalidate. But admission
must test more than cache freshness: consumers need an explicit adequacy decision
and a direct-perception escape hatch.

A stronger evaluation would use diverse natural media, held-out downstream tasks,
multiple generators, repeated runs, and separate measures for description
coverage, answer quality, token amortization, and stale or poisoned-artifact
rejection. Until then, CDAF is credible evidence for the architectural pattern,
not for a universal savings factor.

## Primary sources

- Repository and overview: https://github.com/UditAkhourii/cdaf
- Specification: https://github.com/UditAkhourii/cdaf/blob/61dcde318748a3f5e848830b553c12ef3c52934d/SPEC.md
- Benchmark report: https://github.com/UditAkhourii/cdaf/blob/61dcde318748a3f5e848830b553c12ef3c52934d/benchmarks/RESULTS.md
- Checked-in result records: https://github.com/UditAkhourii/cdaf/blob/61dcde318748a3f5e848830b553c12ef3c52934d/benchmarks/results.json
- Benchmark implementation: https://github.com/UditAkhourii/cdaf/blob/61dcde318748a3f5e848830b553c12ef3c52934d/benchmarks/bench.py
