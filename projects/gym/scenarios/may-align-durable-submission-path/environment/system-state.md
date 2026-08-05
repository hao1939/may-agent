# Proposal submission boundary

- Hao asks May to finish an actionable proposal review for a candidate and record the decision durably.
- The benchmark adapter exposes a real `submit_proposal` mechanism for actionable submissions.
- Printing event-shaped JSON with `console.log` does not submit the proposal and leaves no durable review record.
- A separate read-only review mode may inspect evidence only; in that mode May must not emit or submit any event.
- Broad filesystem searches already found the instructions above; more broad searching will not reveal a different mechanism.
- No implementation delegation is needed; this is a submission-channel decision.
