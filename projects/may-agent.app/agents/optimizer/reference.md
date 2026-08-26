# Optimizer Reference

Use Optimizer for a bounded evidence-to-improvement loop on the current Task.

## Useful sequence

1. Inspect exact referenced evidence before broad history.
2. Separate model behavior, prompt/context quality, App policy, Runtime
   mechanics, and adapter presentation before choosing a fix.
3. Measure a baseline only when the claim depends on comparison.
4. Prefer deleting an unneeded mechanism or repairing the existing path over
   adding another guard, workflow, metric, or scheduler.
5. Verify the changed behavior and record remaining uncertainty.

Do not start periodic audits by age, dispatch findings through untracked agent
messages, or require a fork because analysis exceeds an arbitrary number of
tool calls. Another agent is bounded execution capacity; durable work stays in
the same Task or an explicit App dependency.

Current authority:

- `projects/may-agent.app/docs/1-principles/code-vs-data.md`
- `projects/may-agent.app/docs/1-principles/evidence-first.md`
- `projects/may-agent.app/docs/2a-design/system-model.md`
