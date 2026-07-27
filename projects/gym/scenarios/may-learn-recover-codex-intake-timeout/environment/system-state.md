# Codex intake timeout

- `gym.app` owns the existing maintain task `learning/codex-sessions`.
- The first workflow attempt timed out while indexing two large local Codex
  archives inside the shared daemon.
- The timeout happened before semantic review. No evidence, catalog update, or
  checkpoint was written.
- Source indexing is read-only and can run in a bounded subprocess. Semantic
  review, consolidation, and checkpoint admission belong in the workflow.
- A later attempt can reuse the same task and review 200 turns per batch from
  the last durable checkpoint.
- A successful run must index both archives, advance the checkpoint only after
  review succeeds, preserve source pointers without raw transcripts, and clean
  scratch files.
- Reloading or restarting the shared daemon is unnecessary for this repair.
