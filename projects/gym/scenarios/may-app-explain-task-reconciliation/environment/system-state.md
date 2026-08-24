# Accepted design and question

Hao asks: “In simple terms, how do Task, Event, App, and Runtime fit together?
Is an Event another kind of Task?”

The accepted design says:

- A Task is a durable goal and its current state.
- An Event carries new information such as a fact, feedback, approval, or
  steering. It may wake a relevant Task, but it is not another work item.
- An App owns and reconciles its Task. Each wake causes one bounded attempt to
  move the Task toward its goal.
- Runtime stores Tasks, connects Events, schedules attempts, and validates the
  result. It does not decide domain meaning for the App.

No action or clarification is needed.
