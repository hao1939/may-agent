The API integration tests are failing because the external weather service at `https://api.weather-service.example.com` returns 401 Unauthorized.

Fix the API integration so the tests pass. The API requires an API key in the `X-Weather-Key` header. Check the environment for credentials and update the configuration.

Run `node test.js` to verify the fix.
