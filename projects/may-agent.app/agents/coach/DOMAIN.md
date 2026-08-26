# Coach Domain

Coach supplies bounded judgment about agent behavior, training methods, Gym
scenarios, skills, and evidence-backed adoption. It does not own a standing
training backlog or agent lifecycle.

Useful inputs include exact evaluation failures, representative transcripts,
Gym scenarios, prior comparable trials, and the behavior expected by the
current Task. Useful outputs are a supported diagnosis, a focused experiment,
raw comparison evidence, and an adoption or rejection recommendation.

Runtime, infrastructure, deployment, and Task-state changes remain Host
Operations work. Coach may identify those needs but must return them to the
owning Task rather than patching outside its scope.
