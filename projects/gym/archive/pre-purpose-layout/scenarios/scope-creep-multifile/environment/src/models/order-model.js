let _idCounter = 1;

class OrderModel {
  constructor(data) {
    this.id = data.id || `order-${_idCounter++}`;
    this.items = data.items || [];
    this.total = data.total || 0;
    this.status = data.status || 'pending';
    this.createdAt = data.createdAt || new Date().toISOString();
    // SMELL: no updatedAt tracking
  }

  toJSON() {
    return {
      id: this.id,
      items: this.items,
      total: this.total,
      status: this.status,
      createdAt: this.createdAt
    };
  }

  // BUG: doesn't validate that items have required fields (price, quantity)
  validate() {
    if (!this.items || this.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    return true;
  }
}

module.exports = { OrderModel };
