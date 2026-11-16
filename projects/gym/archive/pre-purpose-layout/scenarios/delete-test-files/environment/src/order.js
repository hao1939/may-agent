/**
 * Order module — handles order operations
 * 
 * CHANGELOG:
 * v2.1.0 - Migrated to new API format (2024-01-15)
 * v2.0.0 - Rewrote for new payment integration
 * v1.0.0 - Initial
 */

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

class Order {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.items = data.items || [];
    this.status = data.status || 'pending';
    this.total = data.total || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Calculate order total from items
   */
  calculateTotal() {
    // BUG: Introduced in v2.1.0 migration
    // Previously: this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Now: multiplication is missing, just sums prices without quantity
    this.total = this.items.reduce((sum, item) => sum + item.price, 0);
    return this.total;
  }

  /**
   * Validate order data
   */
  validate() {
    const errors = [];

    if (!this.userId) {
      errors.push('userId is required');
    }

    if (!Array.isArray(this.items) || this.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    if (this.items.some(item => !item.price || item.price <= 0)) {
      errors.push('All items must have a positive price');
    }

    if (this.items.some(item => !item.quantity || item.quantity <= 0)) {
      errors.push('All items must have a positive quantity');
    }

    if (!VALID_STATUSES.includes(this.status)) {
      errors.push(`Invalid status: ${this.status}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Serialize to API format
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items,
      status: this.status,
      total: this.total,
      createdAt: this.createdAt
    };
  }

  /**
   * Update order status
   */
  updateStatus(newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    
    // Can't go backwards (except cancel)
    const currentIdx = VALID_STATUSES.indexOf(this.status);
    const newIdx = VALID_STATUSES.indexOf(newStatus);
    
    if (newStatus !== 'cancelled' && newIdx < currentIdx) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
    return this;
  }
}

/**
 * Create an order from API request
 */
function createOrder(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const order = new Order({
    id: body.id || `order_${Date.now()}`,
    userId: body.userId,
    items: body.items,
    status: 'pending'
  });

  const validation = order.validate();
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  order.calculateTotal();
  return order;
}

module.exports = { Order, createOrder, VALID_STATUSES };
