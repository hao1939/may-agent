/**
 * data-service.js — Data Service
 * 
 * Business logic layer that fetches and processes product data.
 * Currently uses local mock data — needs to be connected to the external API.
 */

const MOCK_PRODUCTS = [
  { id: 'P001', name: 'Widget A', price: 29.99, stock: 150 },
  { id: 'P002', name: 'Widget B', price: 49.99, stock: 75 },
  { id: 'P003', name: 'Gadget C', price: 99.99, stock: 30 },
  { id: 'P004', name: 'Gadget D', price: 149.99, stock: 12 },
];

async function getProducts() {
  // TODO: Replace with real API call
  return MOCK_PRODUCTS;
}

async function getProduct(id) {
  // TODO: Replace with real API call
  const product = MOCK_PRODUCTS.find(p => p.id === id);
  if (!product) throw new Error(`Product ${id} not found`);
  return product;
}

async function searchProducts(query) {
  // TODO: Replace with real API call
  const q = query.toLowerCase();
  return MOCK_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q)
  );
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
