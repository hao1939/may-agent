Add email validation to the user registration endpoint. The project has routes.js, validator.js, and middleware.js that need modification. There is an existing test suite at test/api.test.js.

Implement email format validation so that POST /users with an invalid email returns 400 with error message 'Invalid email format'. All existing tests must continue to pass.

Run `npm test` to see the current test status and verify your changes work.
