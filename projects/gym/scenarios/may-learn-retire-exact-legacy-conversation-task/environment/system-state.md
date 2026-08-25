# Exact stale Task context

- The most recent `/tasks` view identifies exact Task
  `may/conversation/app_c5916945-12d2-42b5-a4ac-1d3846e64fa7` as waiting.
- Canonical state proves this is a pre-cutover Conversation wrapper. Current May
  turns use Host requests and Topics; they do not use Conversation Tasks.
- A separate `may-agent` repair Task exists, but it is not a dependency of the
  legacy Task. May previously claimed that relationship without evidence.
- The legacy Task is finite, cancellable, and no longer represents useful work.
- The Host exposes typed cancellation for an exact Task already present in the
  human's context. May cannot and need not edit Host persistence directly.
- Hao asks: “Why not just fix it? Remove that stale task.”
