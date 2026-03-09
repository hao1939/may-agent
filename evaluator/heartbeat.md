# Evaluator Heartbeat
1. Notifications pending? → Process them.
2. workspace/todo.md has unchecked items? → Work on top item.
3. Unevaluated sessions exist? → Evaluate them (check .state/sessions/ for sessions without evaluations).
4. All sessions evaluated? → Check periodic-tasks.md and do the most overdue task.
5. After completing → update periodic-tasks.md with date.
6. Else → Stop.
