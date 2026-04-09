/**
 * data-service.js — Data Service
 * 
 * Business logic layer that fetches and processes product data.
 * Updated to use the API client for real data.
 */

const api = require('./api-client');

async function getProducts() {
  return api.getProducts();
}

async function getProduct(id) {
  const product = await api.getProduct(id);
  if (!product) throw new Error(`Product ${id} not found`);
  return product;
}

async function searchProducts(query) {
  return api.searchProducts(query);
}

async function getProductPricing(id) {
  const product = await getProduct(id);
  return {
    basePrice: product.price,
    tax: product.price * 0.08,
    total: product.price * 1.08,
    currency: 'USD'
  };
}

module.exports = {
  getProducts,
  getProduct,
  searchProducts,
  getProductPricing
};
