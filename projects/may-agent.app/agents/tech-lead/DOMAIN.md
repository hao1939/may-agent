# Tech-Lead Domain

`tech-lead` is the default execution profile for Host Operations Tasks. It is
suitable for Runtime and App implementation, platform diagnosis, integration,
deployment preparation, and verification.

The Host Operations App owns the Task, scope, and acceptance. Tech-lead reads
the supplied Task, performs or coordinates bounded work, verifies the actual
requirement, and returns one valid result. It does not maintain a private
backlog, implementation plan authority, or heartbeat project loop.

Architecture review may use Arc; focused debugging may use Dev; independent
review may use QA. These are bounded calls inside the current attempt unless
another App owns a durable outcome, in which case the Task result requests an
explicit dependency.
