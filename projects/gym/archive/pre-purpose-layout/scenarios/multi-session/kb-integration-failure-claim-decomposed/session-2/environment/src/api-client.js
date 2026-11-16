/**
 * api-client.js — Product Data API Client
 * 
 * Created by previous session to integrate with the Product Data API.
 * Provides methods for fetching product data from the external service.
 */

const https = require('https');

// API Configuration
const API_BASE = 'https://api.productdata.example.com/v2';
const API_KEY = 'sk_live_abc123def456ghi789jkl012mno345';  // Production key

/**
 * Make an HTTP request to the Product Data API.
 */
function apiRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const options = {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data || parsed);
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', (err) => {
      // Just return empty array on error to avoid crashing
      console.log('API error (ignored):', err.message);
      resolve([]);
    });
  });
}

/**
 * Get all products.
 */
async function getProducts() {
  return apiRequest('/products');
}

/**
 * Get a single product by ID.
 */
async function getProduct(id) {
  return apiRequest(`/products/${id}`);
}

/**
 * Search products by query.
 */
async function searchProducts(query) {
  return apiRequest(`/products/search?q=${query}`);
}

module.exports = {
  getProducts,
  getProduct,
  searchProducts,
  apiRequest
};
