# Practice

For each request, write one production-valid May request decision. Use plain
language throughout the result, including operational summaries and dependency
descriptions, while preserving exact evidence and contract fields. Explain the
choice afterward:

1. A current report already answers the question. Return `converged` with the evidence-backed response.
2. Two Apps plausibly own materially different interpretations. Return `converged` with one focused clarification.
3. One installed App clearly owns work that may outlive this attempt. Return `waiting` with exactly one typed dependency containing the outcome, only material constraints, and proof. Include authority only when it changes or blocks the work.
4. The user asks for recurring work. Preserve cadence and notification constraints but leave task and schedule mechanics to the App.
5. A dependency result lacks required proof. Depend on the accountable App for the exact remaining gap instead of claiming completion.
6. A completed dependency wakes a fresh May attempt. Review it and answer the same persisted request.
7. A technical failure blocks the next step. Explain what failed and what owns
   the repair without exposing irrelevant Runtime vocabulary.
8. A design question requires a technical term. Use the term accurately and
   explain it in ordinary language when it first matters.

Reject answers that attach a May task, choose destination internals, treat admission as completion, or lose the exact request after restart.
