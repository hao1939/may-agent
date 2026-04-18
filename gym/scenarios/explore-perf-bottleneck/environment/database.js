// database.js — In-memory product database with deliberate inefficiencies
// (simulates a real DB where these patterns cause performance issues)

class Database {
  constructor() {
    this._queryCount = 0;
    this._initData();
  }

  _initData() {
    // Categories
    this._categories = [
      { id: 1, name: 'Electronics', description: 'Gadgets and devices' },
      { id: 2, name: 'Books', description: 'Physical and digital books' },
      { id: 3, name: 'Clothing', description: 'Apparel and accessories' },
      { id: 4, name: 'Home', description: 'Home and garden' },
      { id: 5, name: 'Sports', description: 'Sports and outdoors' },
    ];

    // Products — 50 items across 5 categories
    this._products = [];
    const adjectives = ['Premium', 'Basic', 'Pro', 'Ultra', 'Compact', 'Deluxe', 'Mini', 'Classic', 'Modern', 'Vintage'];
    const items = {
      1: ['Headphones', 'Keyboard', 'Mouse', 'Monitor', 'Speaker', 'Camera', 'Tablet', 'Charger', 'Cable', 'Stand'],
      2: ['Novel', 'Textbook', 'Guide', 'Manual', 'Cookbook', 'Journal', 'Planner', 'Anthology', 'Memoir', 'Atlas'],
      3: ['Shirt', 'Pants', 'Jacket', 'Hat', 'Socks', 'Gloves', 'Scarf', 'Belt', 'Shoes', 'Vest'],
      4: ['Lamp', 'Pillow', 'Rug', 'Vase', 'Clock', 'Frame', 'Shelf', 'Basket', 'Curtain', 'Towel'],
      5: ['Ball', 'Racket', 'Glove', 'Helmet', 'Mat', 'Band', 'Weight', 'Rope', 'Bottle', 'Bag'],
    };

    let id = 1;
    for (const catId of [1, 2, 3, 4, 5]) {
      for (let i = 0; i < 10; i++) {
        this._products.push({
          id: id,
          name: `${adjectives[i]} ${items[catId][i]}`,
          categoryId: catId,
          price: Math.round((10 + Math.random() * 190) * 100) / 100,
          stock: Math.floor(Math.random() * 100),
          createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        });
        id++;
      }
    }

    // Reviews — 3-5 per product
    this._reviews = [];
    let reviewId = 1;
    for (const p of this._products) {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this._reviews.push({
          id: reviewId++,
          productId: p.id,
          rating: 1 + Math.floor(Math.random() * 5),
          text: `Review ${i + 1} for ${p.name}`,
          author: `user_${100 + Math.floor(Math.random() * 900)}`,
        });
      }
    }

    // Discounts — 0-2 per product
    this._discounts = [];
    let discountId = 1;
    for (const p of this._products) {
      const count = Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this._discounts.push({
          id: discountId++,
          productId: p.id,
          percent: 5 + Math.floor(Math.random() * 30),
          code: `SAVE${discountId}`,
          expiresAt: new Date(2025, Math.floor(Math.random() * 12), 28).toISOString(),
        });
      }
    }

    // Related products — 2-4 related per product (random from same category)
    this._related = [];
    for (const p of this._products) {
      const sameCat = this._products.filter(x => x.categoryId === p.categoryId && x.id !== p.id);
      const count = 2 + Math.floor(Math.random() * 3);
      const selected = sameCat.sort(() => Math.random() - 0.5).slice(0, count);
      for (const r of selected) {
        this._related.push({ productId: p.id, relatedId: r.id });
      }
    }
  }

  // Each method simulates a separate DB query (increments counter)
  getAllProducts() {
    this._queryCount++;
    return [...this._products];
  }

  getProductById(id) {
    this._queryCount++;
    return this._products.find(p => p.id === id) || null;
  }

  getAllCategories() {
    this._queryCount++;
    return [...this._categories];
  }

  getCategoryById(id) {
    this._queryCount++;
    return this._categories.find(c => c.id === id) || null;
  }

  getReviewsForProduct(productId) {
    this._queryCount++;
    return this._reviews.filter(r => r.productId === productId);
  }

  getDiscountsForProduct(productId) {
    this._queryCount++;
    return this._discounts.filter(d => d.productId === productId);
  }

  getRelatedProducts(productId) {
    this._queryCount++;
    const relatedIds = this._related
      .filter(r => r.productId === productId)
      .map(r => r.relatedId);
    return relatedIds.map(id => {
      this._queryCount++;
      return this._products.find(p => p.id === id);
    }).filter(Boolean);
  }

  // Diagnostic: how many queries were made
  getQueryCount() {
    return this._queryCount;
  }

  resetQueryCount() {
    this._queryCount = 0;
  }
}

module.exports = { Database };
