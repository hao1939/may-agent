# Persisted May request after restart

Request `may-42` asked Gym to verify a candidate prompt before rollout. Its original session is gone. The exact Gym child request is `done` with evidence:

- frozen baseline and candidate used the same framework revision;
- all five candidate trials passed;
- no approved regression failed;
- candidate fingerprint is `sha256:8b61`;
- broad rollout still requires Hao's approval.
