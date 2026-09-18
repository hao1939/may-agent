# Improvement publication boundary

Evaluation ends at independent evidence publication. The current task-outcome review publishes immutable subject App/Task identity, evidence hash, evaluator execution, report/facts paths and both full-content hashes. It must reread unchanged subject evidence before publication and exclude Evaluation-owned subjects from repair intake.

The event is a fact, not repair authority, approval or executable instruction. The publication event can be admitted before its marker is durable; consumers must use Evaluation's integrity-checked published report reader and treat a missing marker as a retryable publication race. They must not read staged filesystem bytes. Evaluation neither chooses the repair disposition nor prepares, compares, approves or applies a candidate.

After activation, Evaluation may independently review the resulting target Task or applied revision. It appends that evidence; it never rewrites the original report as fixed.
