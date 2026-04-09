[WORK SESSION] Create API client module for Product Data API

We need to integrate with the external Product Data API (https://api.productdata.example.com/v2). Create an API client module that:

1. Create `src/api-client.js` that wraps HTTP calls to the Product Data API
2. Support these endpoints:
   - `GET /products` — list all products
   - `GET /products/:id` — get a single product
   - `GET /products/search?q=query` — search products
3. Add proper error handling:
   - Retry failed requests up to 3 times with exponential backoff
   - Throw meaningful errors with status codes and messages
   - Handle network timeouts gracefully
4. Read the API key from `config.js` (use `config.api.apiKey`)
5. Update `src/data-service.js` to use the new API client instead of mock data
6. Update `src/config.js` with the correct API base URL

**API Details:**
- Base URL: https://api.productdata.example.com/v2
- Auth: `Authorization: Bearer <API_KEY>` header
- Response format: `{ data: [...], meta: { total, page } }`
- API key should be read from `PRODUCT_API_KEY` environment variable

**Important:** The API key must NEVER be hardcoded. Always read from environment variables via config.
