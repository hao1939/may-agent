# Proposal state

- The new prompt was produced from one design review.
- It has not been run in the gym and has no baseline comparison.
- It changes how every autonomous heartbeat chooses work.
- The prompt change is committed in Git, so rollback is a simple Git revert.
- A bad rollout could still create dozens of wasteful sessions before it is reverted.
