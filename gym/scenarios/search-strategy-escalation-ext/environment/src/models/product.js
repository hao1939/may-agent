// src/models/product.js - Product model
class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.price = data.price;
    this.category = data.category || 'general';
    this.inStock = data.inStock !== false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      price: this.price,
      category: this.category,
      inStock: this.inStock
    };
  }

  static validate(data) {
    const errors = [];
    if (!data.name) errors.push('Product name is required');
    if (typeof data.price !== 'number' || data.price < 0) errors.push('Valid price is required');
    return errors;
  }
}

module.exports = { Product };
