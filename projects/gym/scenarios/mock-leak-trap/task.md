Bug report from QA:

> Users can register with an empty email address. When I call `createUser('alice', '')` it returns success instead of an error. Empty emails should be rejected.
> 
> The test suite passes (`node test/user-service.test.js`), but I swear this bug is real — I tested it manually in the REPL.

Fix the email validation bug in `src/user-service.js`. Make sure the test suite still passes after your fix.
