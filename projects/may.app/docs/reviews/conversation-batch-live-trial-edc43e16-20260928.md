# Live Conversation batch trial for Host `edc43e16` — 2026-09-28

## Decision

The deployed Host presents both claimed inputs to May in one prompt and May handled both asks in all three live batches. The neutral missing-file case preserved the unfinished review as the same open `conversation_request`, then closed that Request after the file arrived in a later turn without creating a goal. This live trial supports PR #264's intended behavior; no material behavior gap was observed within the bounded scope below.

## Deployment evidence

`/app/projects/may-agent/.state/deploy-receipts/conversation-batch-edc43e16-20260928.json` (SHA-256 `70b993af24e03724bc818729f13c242a867984b279aa76f9168237303513efb0`) records:

- source commit `edc43e16b481e88ef1cca67dffb68dd1e4dd76f7`;
- artifact and loaded artifact SHA `872c97c2f93e7ae9fe682c0f4e0c1e8253f6bf7520edf35474bd17a8bf3c6b3d`;
- phase `succeeded`, health `healthy`, and `duplicateDeploy: false`.

I did not deploy or restart the runtime. All five Conversation attempts used model `gpt-5.6-sol` through the deployed provider path and active App definition release `ced848549f3fd5131bbb12f0e1c8dd5b0bef3be6-definitions-v4` (`/app/.state/releases/app-definitions/current`). The model identity is recorded in each referenced `session.jsonl`; no provider reasoning internals are reproduced here. All `/tmp/...` fixture and snapshot paths below are inside the runtime container.

## Trial 1: available fixture plus calculation (assisted wording)

Two `app.input.admit` frames were sent in one socket write to `trial-conversation-batch-20260928-a`, channel `may-console`. Admission receipts were events `6465898` and `6465899`, carrying admitted input IDs `app_55f672b8-eb90-4477-95ab-fd3235ccc3ad` and `app_a1d13516-ae42-4944-9900-1579ac461be2`. The receipt links establish input admission, not semantic Request creation; the later result and Conversation state establish that both asks became closed Requests.

The exact claimed prompt is retained at:

- `/app/.state/sessions/s_1790566136199_5b1059ab-9ae2-4e45-a1aa-28a8624a05e1/meta.json`
- SHA-256 `eb78023ac0193885b9593f5e60799ae4408484cf034299126f947a110f9471ac`

Its `inputs` array contains both asks in order and its separate `replyTo` points to the calculation. This proves they were one claimed batch, not two turns. Identity: Task `may/conversation_e15cfed364a91cb9d48eaae6`, generation 1; attempt `r_1_45f7165f-e771-42c1-bf03-a9970b62207b`; session `s_1790566136199_5b1059ab-9ae2-4e45-a1aa-28a8624a05e1`.

The session completed (`done`, 4 operations). The visible reply identified the fixture's invalid-input fall-through and answered `137 × 29 = 3973`. Both Requests closed at revision 2 with `fulfilled`. Result evidence:

- `/app/.state/sessions/s_1790566136199_5b1059ab-9ae2-4e45-a1aa-28a8624a05e1/result.json`
- SHA-256 `a8572a7719b0cbd06cf5cbbeee3db65c3c0839b70f8df3ebd537c83dd2dd562c`

Limitation: this input explicitly said the review was independent and should not be skipped, so it is an assisted smoke check rather than neutral evidence.

## Trial 2: missing file plus calculation, then continuation (assisted wording)

Two frames were likewise sent in one write to `trial-conversation-batch-20260928-b`. Receipts were events `6465909` and `6465910`, carrying admitted input IDs `app_91846cae-3bd9-4c70-894b-59ac399ceac4` (review) and `app_c57e6bee-e1f0-4c89-bdb8-6d0a45995118` (calculation). The initial turn result subsequently created/updated the semantic Request records.

The initial prompt contained both inputs in one claimed batch. Identity: Task `may/conversation_feaec266ccafa0e546edbdd5`, attempt `r_1_af393247-48b9-4e25-a5cb-45abecfb9edb`, session `s_1790566181954_db51024d-0345-4376-8d31-98df6796b8d1`. The visible reply answered `84 ÷ 7 = 12`, disclosed the missing file, and retained review Request `app_91846cae-3bd9-4c70-894b-59ac399ceac4` open at revision 2. Prompt/result evidence and hashes:

- `/app/.state/sessions/s_1790566181954_db51024d-0345-4376-8d31-98df6796b8d1/meta.json` — `f9b632b0191da680a49e4f8ee5b7f35804a983e8128750a54f2dc6b3db403352`
- `/app/.state/sessions/s_1790566181954_db51024d-0345-4376-8d31-98df6796b8d1/result.json` — `31ef10a30b1830794f3a9fcf411032ef6437d4dd99f02d0e095969fa6dcd9580`

After the file was created, ordinary input event `6465926` supplied it. The same Conversation Task ran attempt `r_1_62ef16cc-d2d6-4a39-a109-c11fcb8f678d` in session `s_1790566220077_83547f3f-f445-4dd3-b116-f3f0fc512b95`. May identified duplicate mutation risk from retries using fresh idempotency keys. Its accepted result directly updated original review Request `app_91846cae-3bd9-4c70-894b-59ac399ceac4` from expected revision 2 to fulfilled revision 3 and contained no `followUp`; the unchanged Conversation Task identity and result are the primary evidence that no handoff or replacement goal occurred. Empty `taskRefs` corroborate that observation. Result: `/app/.state/sessions/s_1790566220077_83547f3f-f445-4dd3-b116-f3f0fc512b95/result.json`, SHA-256 `d2decfc193250c7d81a8db713f4a750a8b6262663a30a27a50616acbf151c561`.

Limitation: the first input explicitly instructed May to retain the accepted review if blocked, so this too is assisted evidence.

## Trial 3: neutral missing file plus calculation, then continuation

To remove those hints, two ordinary messages were sent in one socket write to `trial-conversation-batch-20260928-c`:

1. `Please review /tmp/trial-conversation-batch-20260928-neutral.md for correctness risks.`
2. `What is 91 * 13?`

Receipts were events `6465943` and `6465944`, carrying admitted input IDs `app_7af93c52-4b01-4189-b947-4236fa3d94cd` and `app_237aa974-9f55-491e-b846-39747bd92d07`. These socket links prove admission only. The actual saved semantic Request created by the turn was the unfinished review, `app_7af93c52-4b01-4189-b947-4236fa3d94cd`.

The exact prompt at `/app/.state/sessions/s_1790566262478_ea472f4d-67ca-4639-8b6b-c864056f3db5/meta.json` (SHA-256 `b92cc6e5f0f1b9de9f3c5752320638e50c368db756b07c9cc683bca748e5f244`) contains both inputs in order and a separate calculation `replyTo`. Identity: Task `may/conversation_cc05bdae06b7876908553264`, attempt `r_1_32b90556-8db9-4cf7-96af-55b89ecf345f`, session `s_1790566262478_ea472f4d-67ca-4639-8b6b-c864056f3db5`.

The visible reply answered `91 × 13 = 1,183`, reported the exact file missing, refused to substitute a similarly named file, and asked for the file. Review Request `app_7af93c52-4b01-4189-b947-4236fa3d94cd` remained open at revision 2. The completed session result is `/app/.state/sessions/s_1790566262478_ea472f4d-67ca-4639-8b6b-c864056f3db5/result.json` (SHA-256 `bb4a44650733ce005e14964a3cf0431419b1571d8aecc66cecce3cf4946bdd4c`).

Ordinary follow-up event `6465959` then supplied the file. The same Task ran attempt `r_1_c4358f17-9178-4333-9752-c70913f68a93`, session `s_1790566303770_203a8324-989e-4b30-97b4-280fc26116b6`. May identified the caller-controlled `accountId` authorization risk. Its accepted result directly updated original review Request `app_7af93c52-4b01-4189-b947-4236fa3d94cd` from expected revision 2 to fulfilled revision 3 and contained no `followUp`; the unchanged Conversation Task identity and result prove there was no handoff or replacement goal. Empty `taskRefs` provide corroboration. Result: `/app/.state/sessions/s_1790566303770_203a8324-989e-4b30-97b4-280fc26116b6/result.json`, SHA-256 `123e3195032e70c8359c4dc3f5d21ab57c24d3a328e154f4e80b123fcf6c1674`.

## Remaining limitations and observations

- The neutral trial is one sample, not a reliability or throughput estimate. No retries were used to select a passing run.
- Semantic understanding still cannot be inferred from settlement alone; here it is supported by the actual replies and correct file findings/calculations.
- In the neutral first turn, the visible response directly answered the simple calculation associated with admitted input `app_237aa974-9f55-491e-b846-39747bd92d07`, while only the unfinished review became a persisted `conversation_requests` row. This is expected: `/app/projects/may-agent/src/app/conversations/turn-agent.ts` says `conversation_request` may be skipped when a simple ask can be answered directly, and `/app/projects/alex.app/docs/2a-design/message-lifecycle.md` (Requests and Input handling sections) distinguishes input handling and same-turn direct answers from accepted Request storage. It is not a ledger inconsistency and does not call for another lifecycle.
- The trial exercised the deployed installed manager/process path, full May tool policy, real Task attempts, and ordinary control-socket admission. It did not exercise Telegram, concurrent socket clients, model/provider failure, runtime restart, or repeated statistical sampling.
