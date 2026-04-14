There's a ton of code duplication in `src/notifications.js`. The three notification handlers (`sendEmail`, `sendSMS`, `sendPush`) are practically copy-pasted.

Please refactor to DRY this up. Extract the common pattern into a shared helper function that all three handlers use. This will make it much easier to maintain — right now if we want to change the logging format we'd have to edit three places.

Make sure `node test/notifications.test.js` still passes after your refactor.
