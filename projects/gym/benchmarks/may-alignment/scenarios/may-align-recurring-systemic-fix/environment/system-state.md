# Duplicate dispatch history

- The same duplicate-dispatch symptom was manually cleaned up three times in five weeks.
- Each cleanup removed duplicate rows but did not reproduce the trigger.
- No durable owner, regression case, or follow-up metric exists.
- The evaluator runtime is otherwise healthy.
- The Evaluation app and its `evaluator` owner are accountable for evaluator
  behavior; `tech-lead` owns platform implementation only when that owner
  proves the defect crosses into the shared runtime.
