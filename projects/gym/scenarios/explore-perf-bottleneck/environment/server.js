// server.js — Product catalog API
const { Database } = require('./database');

const db = new Database();

// GET /api/products — list all products with category names
function listProducts(query) {
  const { category, minPrice, maxPrice, sort } = query || {};
  
  let products = db.getAllProducts();
  
  // Filter by category
  if (category) {
    products = products.filter(p => {
      const cat = db.getCategoryById(p.categoryId);  // N+1 query — fetches category for EACH product
      return cat && cat.name.toLowerCase() === category.toLowerCase();
    });
  }
  
  // Filter by price range
  if (minPrice !== undefined) {
    products = products.filter(p => p.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    products = products.filter(p => p.price <= maxPrice);
  }
  
  // Enrich with category name and discount info
  const enriched = products.map(p => {
    const cat = db.getCategoryById(p.categoryId);  // Another N+1 — fetches category AGAIN
    const discounts = db.getDiscountsForProduct(p.id);  // N+1 for discounts too
    const reviews = db.getReviewsForProduct(p.id);  // N+1 for reviews
    
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      categoryName: cat ? cat.name : 'Unknown',
      discountCount: discounts.length,
      bestDiscount: discounts.length > 0 
        ? Math.max(...discounts.map(d => d.percent)) 
        : 0,
      avgRating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null,
      reviewCount: reviews.length,
    };
  });
  
  // Sort
  if (sort === 'price_asc') {
    enriched.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_desc') {
    enriched.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    enriched.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
  }
  
  return { status: 200, body: enriched };
}

// GET /api/products/:id — single product with full details
function getProduct(id) {
  const product = db.getProductById(id);
  if (!product) return { status: 404, body: { error: 'Not found' } };
  
  const cat = db.getCategoryById(product.categoryId);
  const discounts = db.getDiscountsForProduct(id);
  const reviews = db.getReviewsForProduct(id);
  const related = db.getRelatedProducts(id);  // Fetches related, then enriches each one
  
  const enrichedRelated = related.map(r => {
    const rCat = db.getCategoryById(r.categoryId);
    const rReviews = db.getReviewsForProduct(r.id);
    return {
      id: r.id,
      name: r.name,
      price: r.price,
      categoryName: rCat ? rCat.name : 'Unknown',
      avgRating: rReviews.length > 0
        ? rReviews.reduce((sum, rv) => sum + rv.rating, 0) / rReviews.length
        : null,
    };
  });
  
  return {
    status: 200,
    body: {
      ...product,
      categoryName: cat ? cat.name : 'Unknown',
      discounts,
      reviews,
      related: enrichedRelated,
    },
  };
}

// GET /api/categories — list categories with product counts
function listCategories() {
  const categories = db.getAllCategories();
  
  // For each category, count products by iterating ALL products
  return {
    status: 200,
    body: categories.map(c => ({
      ...c,
      productCount: db.getAllProducts().filter(p => p.categoryId === c.id).length,  // Scans all products per category
    })),
  };
}

module.exports = { listProducts, getProduct, listCategories };
